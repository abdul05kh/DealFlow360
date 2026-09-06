import { Request, Response, Router } from 'express';
import { prisma } from '../db/client';
import { authMiddleware } from '../middleware/authMiddleware';

export const operatorRouter = Router();

/**
 * GET /api/v1/operator/customer-requests
 * Retrieves customer negotiation requests in the operator work queue.
 * Strictly scoped by authenticated operator role and deal ownership.
 */
operatorRouter.get(
  '/operator/customer-requests',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const role = req.user?.role;
      const userId = req.user?.id;

      let whereClause: any = {
        status: 'SUBMITTED',
      };

      if (role === 'SALES_REP') {
        // Sales Reps can only view customer negotiation requests for quotes created by them
        whereClause.quote = {
          salesRepId: userId,
        };
      } else if (role === 'OPERATIONS_MANAGER') {
        // Operations Managers view requests for approved deals or deals requiring fulfillment context
        whereClause.quote = {
          status: { in: ['APPROVED', 'PENDING_APPROVAL'] },
        };
      }
      // SALES_MANAGER & ADMIN see all submitted customer negotiation requests across all accounts

      const negotiations = await prisma.quoteNegotiation.findMany({
        where: whereClause,
        include: {
          customer: true,
          submittedByUser: true,
          quote: {
            include: {
              salesRep: true,
              lines: { include: { product: true } },
            },
          },
          lines: {
            include: {
              quoteLine: { include: { product: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const workQueueItems = negotiations.map((n: any) => ({
        id: n.id,
        quoteId: n.quoteId,
        quoteNumber: n.quote.quoteNumber,
        quoteStatus: n.quote.status,
        customerId: n.customerId,
        customerName: n.customer.name,
        salesRepId: n.quote.salesRepId,
        salesRepName: n.quote.salesRep.name,
        round: n.round,
        status: n.status,
        customerNote: n.customerNote,
        managerReason: n.managerReason,
        customerResponseNote: n.customerResponseNote,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        financials: {
          grossRevenue: n.quote.grossRevenue,
          discountAmount: n.quote.discountAmount,
          netRevenue: n.quote.netRevenue,
          riskLevel: n.quote.riskLevel,
          riskScore: n.quote.riskScore,
        },
        lines: n.lines.map((nl: any) => ({
          id: nl.id,
          quoteLineId: nl.quoteLineId,
          productId: nl.quoteLine.productId,
          productName: nl.quoteLine.product.name,
          sku: nl.quoteLine.product.sku,
          originalDiscountPercent: nl.quoteLine.discountPercent,
          requestedDiscountPercent: nl.requestedDiscount,
          unitPrice: nl.quoteLine.unitPrice,
          customerNote: nl.customerNote,
        })),
      }));

      res.status(200).json(workQueueItems);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve operator customer requests work queue.',
      });
    }
  }
);

/**
 * GET /api/v1/operator/approval-requests
 * Retrieves pending manager approval requests for initial Sales Rep quotes.
 * Strictly restricted to SALES_MANAGER and ADMIN roles.
 */
operatorRouter.get(
  '/operator/approval-requests',
  authMiddleware(['SALES_MANAGER', 'ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const approvalRequests = await prisma.approvalRequest.findMany({
        where: {
          status: 'PENDING',
          quote: {
            status: 'PENDING_APPROVAL',
          },
        },
        include: {
          quote: {
            include: {
              customer: { include: { tier: true } },
              salesRep: true,
              lines: { include: { product: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const queueItems = approvalRequests.map((ar: any) => {
        let riskReasons: string[] = [];
        if (ar.quote.riskReasonsJson) {
          try {
            riskReasons = JSON.parse(ar.quote.riskReasonsJson);
          } catch {
            riskReasons = [];
          }
        }

        return {
          id: ar.id,
          quoteId: ar.quoteId,
          quoteNumber: ar.quote.quoteNumber,
          quoteStatus: ar.quote.status,
          customerId: ar.quote.customerId,
          customerName: ar.quote.customer?.name || 'Unknown Customer',
          customerTier: ar.quote.customer?.tier?.name || 'STANDARD',
          tierDiscountCeiling: ar.quote.customer?.tier?.maxDiscountPercent || 0,
          salesRepId: ar.quote.salesRepId,
          salesRepName: ar.quote.salesRep?.name || 'Sales Rep',
          requiredRole: ar.requiredRole,
          createdAt: ar.createdAt,
          financials: {
            grossRevenue: ar.quote.grossRevenue,
            discountAmount: ar.quote.discountAmount,
            netRevenue: ar.quote.netRevenue,
            riskLevel: ar.quote.riskLevel,
            riskScore: ar.quote.riskScore,
          },
          riskReasons,
          lines: ar.quote.lines.map((l: any) => ({
            id: l.id,
            productId: l.productId,
            productName: l.product?.name || 'Product',
            sku: l.product?.sku || 'SKU',
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountPercent: l.discountPercent,
            discountAmount: l.discountAmount,
            netTotal: l.netTotal,
          })),
        };
      });

      res.status(200).json(queueItems);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve manager approval requests work queue.',
      });
    }
  }
);

/**
 * GET /api/v1/operator/approval-history
 * Retrieves recently completed manager approval decisions (APPROVED / REJECTED).
 * Strictly restricted to SALES_MANAGER and ADMIN roles.
 */
operatorRouter.get(
  '/operator/approval-history',
  authMiddleware(['SALES_MANAGER', 'ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const historyRequests = await prisma.approvalRequest.findMany({
        where: {
          status: { in: ['APPROVED', 'REJECTED'] },
        },
        include: {
          actionedBy: true,
          quote: {
            include: {
              customer: { include: { tier: true } },
              salesRep: true,
              lines: { include: { product: true } },
            },
          },
        },
        orderBy: { actionedAt: 'desc' },
        take: 10,
      });

      const historyItems = historyRequests.map((ar: any) => {
        let riskReasons: string[] = [];
        if (ar.quote.riskReasonsJson) {
          try {
            riskReasons = JSON.parse(ar.quote.riskReasonsJson);
          } catch {
            riskReasons = [];
          }
        }

        return {
          id: ar.id,
          quoteId: ar.quoteId,
          quoteNumber: ar.quote.quoteNumber,
          decisionStatus: ar.status,
          customerId: ar.quote.customerId,
          customerName: ar.quote.customer?.name || 'Unknown Customer',
          customerTier: ar.quote.customer?.tier?.name || 'STANDARD',
          tierDiscountCeiling: ar.quote.customer?.tier?.maxDiscountPercent || 0,
          salesRepId: ar.quote.salesRepId,
          salesRepName: ar.quote.salesRep?.name || 'Sales Rep',
          actionedById: ar.actionedById,
          actionedByName: ar.actionedBy?.name || 'Morgan Sales Manager',
          actionReason: ar.actionReason || (ar.status === 'APPROVED' ? 'Approved by Sales Manager' : 'Rejected by Sales Manager'),
          actionedAt: ar.actionedAt || ar.createdAt,
          financials: {
            grossRevenue: ar.quote.grossRevenue,
            discountAmount: ar.quote.discountAmount,
            netRevenue: ar.quote.netRevenue,
            riskLevel: ar.quote.riskLevel,
            riskScore: ar.quote.riskScore,
          },
          riskReasons,
          lines: ar.quote.lines.map((l: any) => ({
            id: l.id,
            productId: l.productId,
            productName: l.product?.name || 'Product',
            sku: l.product?.sku || 'SKU',
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountPercent: l.discountPercent,
            discountAmount: l.discountAmount,
            netTotal: l.netTotal,
          })),
        };
      });

      res.status(200).json(historyItems);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve manager approval decision history.',
      });
    }
  }
);

/**
 * GET /api/v1/operator/approved-deals
 * Retrieves quotes in APPROVED or AUTO_APPROVED status for operations fulfillment & billing.
 * Restricted to OPERATIONS_MANAGER, SALES_MANAGER, ADMIN, and SALES_REP roles.
 */
operatorRouter.get(
  '/operator/approved-deals',
  authMiddleware(['OPERATIONS_MANAGER', 'SALES_MANAGER', 'ADMIN', 'SALES_REP']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quotes = await prisma.quote.findMany({
        where: {
          status: { in: ['APPROVED', 'AUTO_APPROVED', 'BILLING_CREATED', 'FULFILLED', 'PAID'] },
        },
        include: {
          customer: { include: { tier: true } },
          salesRep: true,
          lines: { include: { product: true } },
          fulfillmentPlan: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      res.status(200).json(quotes);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve approved deals for operations fulfillment.',
      });
    }
  }
);
