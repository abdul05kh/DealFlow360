import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { approvalRoutingEngine } from '../domain/approval/approvalRoutingEngine';
import { discountGovernance } from '../domain/governance/discountGovernance';
import { marginCalculator } from '../domain/margin/marginCalculator';
import { recommendationEngine } from '../domain/recommendation/recommendationEngine';
import { dealRiskEngine } from '../domain/risk/dealRiskEngine';
import {
  ApprovalDecision,
  DiscountGovernanceResult,
  FinancialSummary,
  NotFoundError,
  RecommendationResult,
  RiskEvaluationResult,
} from '../domain/types';

import { CreateQuoteInputDTO, EvaluateQuoteInputDTO } from '../schemas/quoteSchema';
import { masterDataService } from './masterDataService';

export interface FullQuoteEvaluationResult {
  customer: {
    id: string;
    name: string;
    tier: string;
  };
  financials: FinancialSummary;
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
}

export const quoteService = new QuoteService();
