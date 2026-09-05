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
