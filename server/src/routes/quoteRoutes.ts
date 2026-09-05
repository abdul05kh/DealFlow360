import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validatePayload } from '../middleware/validatePayload';
import {
  ApproveRejectQuoteSchema,
  CreateQuoteSchema,
  EvaluateQuoteSchema,
} from '../schemas/quoteSchema';
import { quoteService } from '../services/quoteService';

export const quoteRouter = Router();

/**
 * POST /api/v1/quotes/evaluate
 * Evaluates a proposed quote against commercial policies without persisting it.
 */
quoteRouter.post(
  '/evaluate',
  authMiddleware(['SALES_REP', 'SALES_MANAGER']),
  validatePayload(EvaluateQuoteSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const evaluation = await quoteService.evaluateQuote(req.body);
      res.status(200).json(evaluation);
    } catch (error: any) {
      res.status(error.name === 'NotFoundError' ? 404 : 400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/quotes
 * Evaluates, persists, and audits a new Quote.
 */
quoteRouter.post(
  '/',
  authMiddleware(['SALES_REP', 'SALES_MANAGER']),
  validatePayload(CreateQuoteSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const salesRepId = req.user?.id || 'rep_1';
      const actorName = req.user?.role === 'SALES_MANAGER' ? 'Morgan Sales Manager' : 'Alex Sales Rep';

      const quote = await quoteService.createQuote(req.body, salesRepId, actorName);
      res.status(201).json(quote);
    } catch (error: any) {
      res.status(error.name === 'NotFoundError' ? 404 : 400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/quotes/:quoteId/approve
 * Approves a quote in PENDING_APPROVAL status. Requires SALES_MANAGER role.
 */
quoteRouter.post(
  '/:quoteId/approve',
  authMiddleware(['SALES_MANAGER']),
  validatePayload(ApproveRejectQuoteSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.quoteId as string;
      const approverId = req.user?.id || 'mgr_1';
      const approverRole = req.user?.role as 'SALES_MANAGER' | 'FINANCE_APPROVER';
      const reason = req.body.reason;

      const approvedQuote = await quoteService.approveQuote(
        quoteId,
        approverId,
        approverRole,
        'Morgan Sales Manager',
        reason
      );

      res.status(200).json(approvedQuote);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: 'NotFound', message: error.message });
        return;
      }
      if (error.name === 'InvalidStateTransitionError') {
        res.status(409).json({ error: 'Conflict', message: error.message });
        return;
      }
      res.status(400).json({ error: error.name || 'BadRequest', message: error.message });
    }
  }
);

/**
 * POST /api/v1/quotes/:quoteId/reject
 * Rejects a quote in PENDING_APPROVAL status. Requires SALES_MANAGER role.
 */
quoteRouter.post(
  '/:quoteId/reject',
  authMiddleware(['SALES_MANAGER']),
  validatePayload(ApproveRejectQuoteSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.quoteId as string;
      const approverId = req.user?.id || 'mgr_1';
      const approverRole = req.user?.role as 'SALES_MANAGER' | 'FINANCE_APPROVER';
      const reason = req.body.reason;

      const rejectedQuote = await quoteService.rejectQuote(
        quoteId,
        approverId,
        approverRole,
        'Morgan Sales Manager',
        reason
      );

      res.status(200).json(rejectedQuote);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: 'NotFound', message: error.message });
        return;
      }
      if (error.name === 'InvalidStateTransitionError') {
        res.status(409).json({ error: 'Conflict', message: error.message });
        return;
      }
      res.status(400).json({ error: error.name || 'BadRequest', message: error.message });
    }
  }
);

/**
 * GET /api/v1/quotes/:quoteId
 * Retrieves quote details with lines and audit history.
 */
quoteRouter.get(
  '/:quoteId',
  authMiddleware(['SALES_REP', 'SALES_MANAGER']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.quoteId as string;
      const quote = await quoteService.getQuoteById(quoteId);
      res.status(200).json(quote);
    } catch (error: any) {
      res.status(error.name === 'NotFoundError' ? 404 : 400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);
