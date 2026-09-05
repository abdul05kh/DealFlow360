import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validatePayload } from '../middleware/validatePayload';
import { GenerateBillingSchema } from '../schemas/billingSchema';
import { billingService } from '../services/billingService';

export const billingRouter = Router();

/**
 * POST /api/v1/quotes/:quoteId/billing
 * Generates hybrid billing representation (invoice & subscriptions) for an approved quote.
 */
billingRouter.post(
  '/quotes/:quoteId/billing',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'ADMIN', 'CUSTOMER']),
  validatePayload(GenerateBillingSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.quoteId as string;
      const actorId = req.user?.id || 'sys_1';
      const actorName = req.user?.id || 'Authorized User';
      const userRole = req.user?.role || 'SALES_REP';
      const userCustomerId = req.user?.customerId;

      const summary = await billingService.generateBillingForQuote(
        quoteId,
        actorId,
        actorName,
        userRole,
        userCustomerId
      );

      res.status(201).json(summary);
    } catch (error: any) {
      const status = error.statusCode || (error.name === 'NotFoundError' ? 404 : 400);
      res.status(status).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/quotes/:quoteId/billing
 * Retrieves the billing summary for a quote.
 */
billingRouter.get(
  '/quotes/:quoteId/billing',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN', 'CUSTOMER']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.quoteId as string;
      const userRole = req.user?.role || 'SALES_REP';
      const userCustomerId = req.user?.customerId;

      const summary = await billingService.getBillingSummaryByQuoteId(
        quoteId,
        userRole,
        userCustomerId
      );

      res.status(200).json(summary);
    } catch (error: any) {
      const status = error.statusCode || (error.name === 'NotFoundError' ? 404 : 400);
      res.status(status).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/customer/billing
 * Retrieves invoices and subscriptions for the authenticated customer as sanitized DTOs.
 */
billingRouter.get(
  '/customer/billing',
  authMiddleware(['CUSTOMER']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = req.user?.customerId;
      if (!customerId) {
        res.status(403).json({
          error: 'ForbiddenError',
          message: 'Customer identity is missing or invalid.',
        });
        return;
      }

      const billing = await billingService.getCustomerBilling(customerId);
      res.status(200).json(billing);
    } catch (error: any) {
      const status = error.statusCode || (error.name === 'NotFoundError' ? 404 : 400);
      res.status(status).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);
