import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { approvalRoutingEngine } from '../domain/approval/approvalRoutingEngine';
import { discountGovernance } from '../domain/governance/discountGovernance';
import { marginCalculator } from '../domain/margin/marginCalculator';
import { recommendationEngine } from '../domain/recommendation/recommendationEngine';
import { dealRiskEngine } from '../domain/risk/dealRiskEngine';
import {
  ApprovalDecision,
  CustomerNegotiationDTO,
  CustomerQuoteDTO,
  CustomerQuoteLineDTO,
  DiscountGovernanceResult,
  FinancialSummary,
  MarginRealizationResult,
  NotFoundError,
  RecommendationResult,
  RiskEvaluationResult,
} from '../domain/types';
import { marginRealizationEngine } from '../domain/margin/marginRealizationEngine';

import { CreateQuoteInputDTO, EvaluateQuoteInputDTO } from '../schemas/quoteSchema';
import { SubmitNegotiationInputDTO, RespondNegotiationInputDTO } from '../schemas/negotiationSchema';
import { masterDataService } from './masterDataService';

export interface FullQuoteEvaluationResult {
  customer: {
    id: string;
    name: string;
    tier: string;
  };
  financials: FinancialSummary;
  marginRealization: MarginRealizationResult;
  governance: DiscountGovernanceResult;
  risk: RiskEvaluationResult;
  decision: ApprovalDecision;
  recommendations: RecommendationResult[];
}

export class QuoteService {
  /**
   * Evaluates a proposed quote against authoritative server master data and pure domain engines.
   */
  async evaluateQuote(input: EvaluateQuoteInputDTO): Promise<FullQuoteEvaluationResult> {
    // 1. Fetch authoritative Customer & Tier
    const customer = await masterDataService.getCustomerWithTier(input.customerId);
    if (!customer) {
      throw new NotFoundError('Customer', input.customerId);
    }

    // 2. Fetch authoritative Products & Categories
    const productIds = input.items.map((i) => i.productId);
    const productMap = await masterDataService.getProductsByIds(productIds);

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) {
        throw new NotFoundError('Product', item.productId);
      }
    }

    // 3. Calculate Financial Summary
    const financials = marginCalculator.calculateQuote(input.items, productMap);

    // 3.5 Calculate Server-Authoritative Margin Realization Index (MRI)
    const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);
    const marginRealization = marginRealizationEngine.calculateMRI(financials, totalQuantity, customer.tier);

    // 4. Evaluate Discount Governance
    const policies = await masterDataService.getAllDiscountPolicies();
    const governance = discountGovernance.evaluate(financials, customer, productMap, policies);

    // 5. Evaluate Deal Risk
    const risk = dealRiskEngine.evaluateRisk(governance);

    // 6. Determine Approval Decision & Status
    const rules = await masterDataService.getAllApprovalRules();
    const decision = approvalRoutingEngine.determineDecision(risk, rules);

    // 7. Evaluate Cross-Sell Recommendations
    const crossSellRules = await masterDataService.getCrossSellRules();
    const recommendations = recommendationEngine.evaluateRecommendations(
      input.items,
      financials,
      crossSellRules,
      productMap
    );

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        tier: customer.tier.name,
      },
      financials,
      marginRealization,
      governance,
      risk,
      decision,
      recommendations,
    };
  }

  /**
   * Evaluates, persists, and audits a new Quote within a single Prisma transaction.
   */
  async createQuote(
    input: CreateQuoteInputDTO,
    salesRepId: string,
    actorName: string
  ) {
    const evalResult = await this.evaluateQuote(input);

    const quoteNumber = `QT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create Quote record
      const quote = await tx.quote.create({
        data: {
          quoteNumber,
          customerId: input.customerId,
          salesRepId,
          status: evalResult.decision.quoteStatus,
          grossRevenue: evalResult.financials.grossRevenue,
          discountAmount: evalResult.financials.discountAmount,
          netRevenue: evalResult.financials.netRevenue,
          estimatedCost: evalResult.financials.estimatedCost,
          grossMargin: evalResult.financials.grossMargin,
          marginPercentage: evalResult.financials.marginPercentage,
          riskLevel: evalResult.risk.riskLevel,
          riskScore: evalResult.risk.riskScore,
          riskReasonsJson: JSON.stringify(evalResult.risk.reasons),
          requiredApproverRole: evalResult.decision.requiredRole,
          lines: {
            create: evalResult.financials.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              discountPercent: line.discountPercent,
              discountAmount: line.discountAmount,
              subtotal: line.lineGross,
              netTotal: line.netTotal,
              lineCost: line.lineCost,
              lineMargin: line.lineMargin,
            })),
          },
        },
        include: {
          customer: { include: { tier: true } },
          lines: { include: { product: { include: { category: true } } } },
        },
      });

      // 2. Create ApprovalRequest if approval is required
      if (evalResult.decision.requiresApproval) {
        await tx.approvalRequest.create({
          data: {
            quoteId: quote.id,
            status: 'PENDING',
            requiredRole: evalResult.decision.requiredRole ?? 'SALES_MANAGER',
          },
        });
      }

      // 3. Log Audit Event
      await tx.auditEvent.create({
        data: {
          entityType: 'QUOTE',
          entityId: quote.id,
          actorId: salesRepId,
          actorName,
          action: 'QUOTE_CREATED',
          newStateJson: JSON.stringify({
            quoteNumber: quote.quoteNumber,
            status: quote.status,
            netRevenue: quote.netRevenue,
            marginPercentage: quote.marginPercentage,
            riskScore: quote.riskScore,
            riskLevel: quote.riskLevel,
          }),
          contextJson: JSON.stringify({
            requiresApproval: evalResult.decision.requiresApproval,
            reasons: evalResult.risk.reasons,
          }),
        },
      });

      return {
        ...quote,
        evaluation: evalResult,
      };
    });
  }

  /**
   * Approves a quote within a single Prisma transaction after validating state transitions.
   */
  async approveQuote(
    quoteId: string,
    approverId: string,
    approverRole: 'SALES_MANAGER' | 'FINANCE_APPROVER',
    actorName: string,
    reason?: string
  ) {
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { approvalRequests: true },
    });

    if (!existingQuote) {
      throw new NotFoundError('Quote', quoteId);
    }

    // Validate state transition using pure ApprovalRoutingEngine
    approvalRoutingEngine.validateTransition(
      existingQuote.status as any,
      'APPROVED',
      { actorRole: approverRole }
    );

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Update Quote
      const updatedQuote = await tx.quote.update({
        where: { id: quoteId },
        data: { status: 'APPROVED' },
        include: {
          customer: true,
          lines: { include: { product: true } },
          approvalRequests: true,
        },
      });

      // 2. Update pending ApprovalRequest if one exists
      const pendingReq = existingQuote.approvalRequests.find((r: { status: string }) => r.status === 'PENDING');
      if (pendingReq) {
        await tx.approvalRequest.update({
          where: { id: pendingReq.id },
          data: {
            status: 'APPROVED',
            actionedById: approverId,
            actionedAt: new Date(),
            actionReason: reason ?? 'Approved by authorized manager.',
          },
        });
      }

      // 3. Log Audit Event
      await tx.auditEvent.create({
        data: {
          entityType: 'QUOTE',
          entityId: quoteId,
          actorId: approverId,
          actorName,
          action: 'QUOTE_APPROVED',
          previousStateJson: JSON.stringify({ status: existingQuote.status }),
          newStateJson: JSON.stringify({ status: 'APPROVED' }),
          contextJson: JSON.stringify({ reason }),
        },
      });

      return updatedQuote;
    });
  }

  /**
   * Rejects a quote within a single Prisma transaction after validating state transitions.
   */
  async rejectQuote(
    quoteId: string,
    approverId: string,
    approverRole: 'SALES_MANAGER' | 'FINANCE_APPROVER',
    actorName: string,
    reason?: string
  ) {
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { approvalRequests: true },
    });

    if (!existingQuote) {
      throw new NotFoundError('Quote', quoteId);
    }

    // Validate state transition using pure ApprovalRoutingEngine
    approvalRoutingEngine.validateTransition(
      existingQuote.status as any,
      'REJECTED',
      { actorRole: approverRole }
    );

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Update Quote
      const updatedQuote = await tx.quote.update({
        where: { id: quoteId },
        data: { status: 'REJECTED' },
        include: {
          customer: true,
          lines: { include: { product: true } },
          approvalRequests: true,
        },
      });

      // 2. Update pending ApprovalRequest if one exists
      const pendingReq = existingQuote.approvalRequests.find((r: { status: string }) => r.status === 'PENDING');
      if (pendingReq) {
        await tx.approvalRequest.update({
          where: { id: pendingReq.id },
          data: {
            status: 'REJECTED',
            actionedById: approverId,
            actionedAt: new Date(),
            actionReason: reason ?? 'Rejected by authorized manager.',
          },
        });
      }

      // 3. Log Audit Event
      await tx.auditEvent.create({
        data: {
          entityType: 'QUOTE',
          entityId: quoteId,
          actorId: approverId,
          actorName,
          action: 'QUOTE_REJECTED',
          previousStateJson: JSON.stringify({ status: existingQuote.status }),
          newStateJson: JSON.stringify({ status: 'REJECTED' }),
          contextJson: JSON.stringify({ reason }),
        },
      });

      return updatedQuote;
    });
  }

  /**
   * Retrieves quote details by ID along with audit history.
   */
  async getQuoteById(quoteId: string) {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: { include: { tier: true } },
        salesRep: true,
        lines: { include: { product: { include: { category: true } } } },
        approvalRequests: { include: { actionedBy: true } },
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote', quoteId);
    }

    const auditHistory = await prisma.auditEvent.findMany({
      where: { entityType: 'QUOTE', entityId: quoteId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...quote,
      auditHistory,
    };
  }

  /**
   * Sanitizes a full Quote object into a customer-safe DTO.
   * Explicitly strips internal costs, gross margins, MRI, risk scores, and internal manager notes.
   */
  public sanitizeCustomerQuoteDTO(quote: any): CustomerQuoteDTO {
    const lines: CustomerQuoteLineDTO[] = (quote.lines || []).map((l: any) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product?.name || 'Product',
      sku: l.product?.sku || '',
      quantity: l.quantity,
      offeredUnitPrice: l.unitPrice,
      offeredDiscountPercent: l.discountPercent,
      offeredLineTotal: l.netTotal,
    }));

    const sortedNegotiations = [...(quote.negotiations || [])].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const negotiationHistory: CustomerNegotiationDTO[] = sortedNegotiations.map((n: any) => ({
      id: n.id,
      round: n.round,
      status: n.status as 'SUBMITTED' | 'APPROVED' | 'REJECTED',
      customerNote: n.customerNote,
      customerResponseNote: n.customerResponseNote, // Customer-safe decision text ONLY
      createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
      lines: (n.lines || []).map((nl: any) => ({
        quoteLineId: nl.quoteLineId,
        requestedDiscountPercent: nl.requestedDiscount,
        customerNote: nl.customerNote,
      })),
    }));

    const activeNegotiation = sortedNegotiations.length > 0 ? negotiationHistory[0] : null;

    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      currency: quote.customer?.currency || 'INR',
      createdAt: quote.createdAt ? new Date(quote.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: quote.updatedAt ? new Date(quote.updatedAt).toISOString() : new Date().toISOString(),
      totalOfferedGross: quote.grossRevenue,
      totalOfferedDiscount: quote.discountAmount,
      totalNetRevenue: quote.netRevenue,
      lines,
      activeNegotiation,
      negotiationHistory,
    };
  }

  /**
   * Retrieves customer-safe quotes for a specific customer ID.
   */
  async getCustomerQuotes(customerId: string): Promise<CustomerQuoteDTO[]> {
    const quotes = await prisma.quote.findMany({
      where: { customerId },
      include: {
        customer: true,
        lines: { include: { product: true } },
        negotiations: { include: { lines: true }, orderBy: { round: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return quotes.map((q) => this.sanitizeCustomerQuoteDTO(q));
  }

  /**
   * Retrieves a single customer-safe quote by ID, enforcing strict tenant ownership.
   */
  async getCustomerQuoteById(quoteId: string, customerId: string): Promise<CustomerQuoteDTO> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: true,
        lines: { include: { product: true } },
        negotiations: { include: { lines: true }, orderBy: { round: 'desc' } },
      },
    });

    if (!quote || quote.customerId !== customerId) {
      throw new NotFoundError('Quote', quoteId);
    }

    return this.sanitizeCustomerQuoteDTO(quote);
  }

  /**
   * Submits a customer counter-offer negotiation, re-evaluating deal terms authoritatively.
   */
  async submitCustomerNegotiation(
    quoteId: string,
    customerId: string,
    userId: string,
    input: SubmitNegotiationInputDTO
  ): Promise<CustomerQuoteDTO> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: { include: { tier: true } },
        lines: { include: { product: true } },
        negotiations: { include: { lines: true } },
      },
    });

    if (!quote || quote.customerId !== customerId) {
      throw new NotFoundError('Quote', quoteId);
    }

    // Map evaluation items supporting Partial Line Negotiation
    const evaluationItems = quote.lines.map((line) => {
      const counterLine = input.lines.find((l: { quoteLineId: string }) => l.quoteLineId === line.id);
      return {
        productId: line.productId,
        quantity: line.quantity,
        discountPercent: counterLine ? counterLine.requestedDiscount : line.discountPercent,
      };
    });

    // Re-evaluate deal using AUTHORITATIVE server engines
    const evalResult = await this.evaluateQuote({
      customerId: quote.customerId,
      items: evaluationItems,
    });

    const requiresApproval = evalResult.decision.requiresApproval;
    const round = quote.negotiations.length + 1;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create QuoteNegotiation record
      const negotiationStatus = requiresApproval ? 'SUBMITTED' : 'APPROVED';
      const negotiation = await tx.quoteNegotiation.create({
        data: {
          quoteId: quote.id,
          customerId: quote.customerId,
          submittedByUserId: userId,
          round,
          status: negotiationStatus,
          customerNote: input.customerNote || null,
        },
      });

      // 2. Create QuoteNegotiationLine records
      for (const counterItem of input.lines) {
        await tx.quoteNegotiationLine.create({
          data: {
            negotiationId: negotiation.id,
            quoteLineId: counterItem.quoteLineId,
            requestedDiscount: counterItem.requestedDiscount,
            customerNote: counterItem.customerNote || null,
          },
        });
      }

      // 3. Update Quote status and financials based on governance result
      if (!requiresApproval) {
        // Counter-offer passes governance automatically -> AUTO_APPROVED / APPROVED
        await tx.quote.update({
          where: { id: quote.id },
          data: {
            status: 'APPROVED',
            grossRevenue: evalResult.financials.grossRevenue,
            discountAmount: evalResult.financials.discountAmount,
            netRevenue: evalResult.financials.netRevenue,
            estimatedCost: evalResult.financials.estimatedCost,
            grossMargin: evalResult.financials.grossMargin,
            marginPercentage: evalResult.financials.marginPercentage,
            riskLevel: evalResult.risk.riskLevel,
            riskScore: evalResult.risk.riskScore,
          },
        });

        // Update QuoteLines with negotiated terms
        for (const evalLine of evalResult.financials.lines) {
          const dbLine = quote.lines.find((l) => l.productId === evalLine.productId);
          if (dbLine) {
            await tx.quoteLine.update({
              where: { id: dbLine.id },
              data: {
                discountPercent: evalLine.discountPercent,
                discountAmount: evalLine.discountAmount,
                netTotal: evalLine.netTotal,
                lineMargin: evalLine.lineMargin,
              },
            });
          }
        }
      } else {
        // Counter-offer requires manager review -> PENDING_APPROVAL
        await tx.quote.update({
          where: { id: quote.id },
          data: { status: 'PENDING_APPROVAL' },
        });

        const pendingReq = await tx.approvalRequest.findFirst({
          where: { quoteId: quote.id, status: 'PENDING' },
        });

        if (!pendingReq) {
          await tx.approvalRequest.create({
            data: {
              quoteId: quote.id,
              status: 'PENDING',
              requiredRole: evalResult.decision.requiredRole || 'SALES_MANAGER',
            },
          });
        }
      }

      // 4. Log Audit Event
      await tx.auditEvent.create({
        data: {
          entityType: 'QUOTE',
          entityId: quote.id,
          actorId: userId,
          actorName: 'Customer User',
          action: 'NEGOTIATION_SUBMITTED',
          newStateJson: JSON.stringify({
            round,
            negotiationStatus,
            requiresApproval,
            requestedLines: input.lines,
          }),
        },
      });
    });

    return this.getCustomerQuoteById(quoteId, customerId);
  }

  /**
   * Responds to a pending customer negotiation (Manager APPROVE / REJECT).
   * Prevents stale approval by re-evaluating terms fresh at approval time.
   */
  async respondToNegotiation(
    quoteId: string,
    negotiationId: string,
    approverId: string,
    approverRole: 'SALES_MANAGER' | 'FINANCE_APPROVER',
    actorName: string,
    input: RespondNegotiationInputDTO
  ) {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        lines: { include: { product: true } },
        negotiations: { include: { lines: true } },
        approvalRequests: true,
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote', quoteId);
    }

    const negotiation = quote.negotiations.find((n) => n.id === negotiationId);
    if (!negotiation || negotiation.status !== 'SUBMITTED') {
      const err: any = new Error('Active submitted negotiation not found for ID: ' + negotiationId);
      err.statusCode = 400;
      throw err;
    }

    if (input.action === 'APPROVE') {
      // Prevent stale approval: re-evaluate fresh at approval time
      const evaluationItems = quote.lines.map((line) => {
        const counterLine = negotiation.lines.find((l) => l.quoteLineId === line.id);
        return {
          productId: line.productId,
          quantity: line.quantity,
          discountPercent: counterLine ? counterLine.requestedDiscount : line.discountPercent,
        };
      });

      const evalResult = await this.evaluateQuote({
        customerId: quote.customerId,
        items: evaluationItems,
      });

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Update QuoteNegotiation status to APPROVED
        await tx.quoteNegotiation.update({
          where: { id: negotiation.id },
          data: {
            status: 'APPROVED',
            managerReason: input.managerReason || null,
            customerResponseNote: input.customerResponseNote || 'Negotiation approved by Sales Manager.',
          },
        });

        // 2. Update Quote status & financial totals to fresh re-evaluated terms
        await tx.quote.update({
          where: { id: quote.id },
          data: {
            status: 'APPROVED',
            grossRevenue: evalResult.financials.grossRevenue,
            discountAmount: evalResult.financials.discountAmount,
            netRevenue: evalResult.financials.netRevenue,
            estimatedCost: evalResult.financials.estimatedCost,
            grossMargin: evalResult.financials.grossMargin,
            marginPercentage: evalResult.financials.marginPercentage,
            riskLevel: evalResult.risk.riskLevel,
            riskScore: evalResult.risk.riskScore,
          },
        });

        // 3. Update QuoteLine records with negotiated terms
        for (const evalLine of evalResult.financials.lines) {
          const dbLine = quote.lines.find((l) => l.productId === evalLine.productId);
          if (dbLine) {
            await tx.quoteLine.update({
              where: { id: dbLine.id },
              data: {
                discountPercent: evalLine.discountPercent,
                discountAmount: evalLine.discountAmount,
                netTotal: evalLine.netTotal,
                lineMargin: evalLine.lineMargin,
              },
            });
          }
        }

        // 4. Update ApprovalRequest
        const pendingReq = quote.approvalRequests.find((r) => r.status === 'PENDING');
        if (pendingReq) {
          await tx.approvalRequest.update({
            where: { id: pendingReq.id },
            data: {
              status: 'APPROVED',
              actionedById: approverId,
              actionedAt: new Date(),
              actionReason: input.managerReason || 'Approved negotiated counter-offer.',
            },
          });
        }

        // 5. Log Audit Event
        await tx.auditEvent.create({
          data: {
            entityType: 'QUOTE',
            entityId: quote.id,
            actorId: approverId,
            actorName,
            action: 'NEGOTIATION_APPROVED',
            newStateJson: JSON.stringify({
              negotiationId: negotiation.id,
              status: 'APPROVED',
              netRevenue: evalResult.financials.netRevenue,
            }),
            contextJson: JSON.stringify({
              managerReason: input.managerReason,
              customerResponseNote: input.customerResponseNote,
            }),
          },
        });
      });
    } else {
      // Rejection: Update QuoteNegotiation.status = 'REJECTED' and Quote.status = 'REJECTED'
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.quoteNegotiation.update({
          where: { id: negotiation.id },
          data: {
            status: 'REJECTED',
            managerReason: input.managerReason || null,
            customerResponseNote: input.customerResponseNote || 'Counter-offer declined by Sales Manager.',
          },
        });

        await tx.quote.update({
          where: { id: quote.id },
          data: { status: 'APPROVED' },
        });

        const pendingReq = quote.approvalRequests.find((r) => r.status === 'PENDING');
        if (pendingReq) {
          await tx.approvalRequest.update({
            where: { id: pendingReq.id },
            data: {
              status: 'REJECTED',
              actionedById: approverId,
              actionedAt: new Date(),
              actionReason: input.managerReason || 'Declined negotiated counter-offer.',
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            entityType: 'QUOTE',
            entityId: quote.id,
            actorId: approverId,
            actorName,
            action: 'NEGOTIATION_REJECTED',
            newStateJson: JSON.stringify({
              negotiationId: negotiation.id,
              status: 'REJECTED',
            }),
            contextJson: JSON.stringify({
              managerReason: input.managerReason,
              customerResponseNote: input.customerResponseNote,
            }),
          },
        });
      });
    }

    return this.getQuoteById(quoteId);
  }
}

export const quoteService = new QuoteService();
