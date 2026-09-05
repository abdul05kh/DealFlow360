import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validatePayload } from '../middleware/validatePayload';
import { submitNegotiationSchema } from '../schemas/negotiationSchema';
import { quoteService } from '../services/quoteService';

export const customerRouter = Router();

/**
 * GET /api/v1/customer/quotes
 * Retrieves all quotes for the authenticated customer as sanitized DTOs.
 */
customerRouter.get(
  '/quotes',
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

      const quotes = await quoteService.getCustomerQuotes(customerId);
      res.status(200).json(quotes);
    } catch (error: any) {
      res.status(error.name === 'NotFoundError' ? 404 : 400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/customer/quotes/:quoteId
 * Retrieves a single quote for the authenticated customer as a sanitized DTO.
 */
customerRouter.get(
  '/quotes/:quoteId',
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

      const quoteId = req.params.quoteId as string;
      const quote = await quoteService.getCustomerQuoteById(quoteId, customerId);
      res.status(200).json(quote);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: 'NotFound', message: error.message });
        return;
      }
      res.status(400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/customer/quotes/:quoteId/negotiate
 * Submits a line-item counter-offer for a quote belonging to the customer.
 */
customerRouter.post(
  '/quotes/:quoteId/negotiate',
  authMiddleware(['CUSTOMER']),
  validatePayload(submitNegotiationSchema),
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

      const quoteId = req.params.quoteId as string;
      const userId = req.user?.id || 'cust_1';

      const result = await quoteService.submitCustomerNegotiation(
        quoteId,
        customerId,
        userId,
        req.body
      );

      res.status(200).json(result);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: 'NotFound', message: error.message });
        return;
      }
      if (error.name === 'InvalidStateTransitionError') {
        res.status(409).json({ error: 'Conflict', message: error.message });
        return;
      }
      res.status(400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);
