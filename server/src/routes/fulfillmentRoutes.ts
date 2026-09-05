import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validatePayload } from '../middleware/validatePayload';
import {
  AllocateFulfillmentSchema,
  EvaluateFulfillmentSchema,
} from '../schemas/fulfillmentSchema';
import { fulfillmentService } from '../services/fulfillmentService';

export const fulfillmentRouter = Router();

/**
 * GET /api/v1/warehouses & GET /api/v1/fulfillment/warehouses
 * Read-only endpoint returning active distribution warehouses and per-product inventory stocks.
 */
const getWarehousesHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const warehouses = await fulfillmentService.getAllWarehouses();
    res.status(200).json(warehouses);
  } catch (error: any) {
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve warehouses master data.',
    });
  }
};

fulfillmentRouter.get(
  '/warehouses',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER']),
  getWarehousesHandler
);

fulfillmentRouter.get(
  '/fulfillment/warehouses',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER']),
  getWarehousesHandler
);

/**
 * POST /api/v1/fulfillment/evaluate
 * Simulation-only endpoint evaluating multi-warehouse fulfillment allocation for an approved quote.
 * MUST NOT mutate inventory, create fulfillment plans, or write audit events.
 */
fulfillmentRouter.post(
  '/fulfillment/evaluate',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER']),
  validatePayload(EvaluateFulfillmentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await fulfillmentService.evaluateFulfillment(req.body.quoteId);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: 'NotFound', message: error.message });
        return;
      }
      res.status(400).json({ error: error.name || 'BadRequest', message: error.message });
    }
  }
);

/**
 * POST /api/v1/fulfillment/allocate
 * Finalizes and persists fulfillment plan and reserves stock for an approved quote.
 * Requires SALES_MANAGER or OPERATIONS_MANAGER role. (SALES_REP is blocked with 403).
 */
fulfillmentRouter.post(
  '/fulfillment/allocate',
  authMiddleware(['SALES_MANAGER', 'OPERATIONS_MANAGER']),
  validatePayload(AllocateFulfillmentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = req.user?.id || 'ops_1';
      const actorName =
        req.user?.role === 'OPERATIONS_MANAGER'
          ? 'Operations Lead'
          : req.user?.role === 'SALES_MANAGER'
          ? 'Morgan Sales Manager'
          : 'Fulfillment Lead';

      const plan = await fulfillmentService.allocateFulfillment(
        req.body.quoteId,
        req.body.manualOverrides,
        actorId,
        actorName
      );

      res.status(201).json(plan);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: 'NotFound', message: error.message });
        return;
      }
      if (error.name === 'InvalidStateTransitionError') {
        res.status(409).json({ error: 'Conflict', message: error.message });
        return;
      }
      if (error.name === 'DomainValidationError') {
        res.status(409).json({ error: 'Conflict', message: error.message });
        return;
      }
      res.status(400).json({ error: error.name || 'BadRequest', message: error.message });
    }
  }
);

/**
 * GET /api/v1/fulfillment/quote/:quoteId
 * Retrieves persisted fulfillment plan details, shipment splits, and audit history.
 */
fulfillmentRouter.get(
  '/fulfillment/quote/:quoteId',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.quoteId as string;
      const plan = await fulfillmentService.getFulfillmentByQuoteId(quoteId);
      res.status(200).json(plan);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        res.status(404).json({ error: 'NotFound', message: error.message });
        return;
      }
      res.status(400).json({ error: error.name || 'BadRequest', message: error.message });
    }
  }
);
