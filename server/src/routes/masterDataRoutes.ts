import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { masterDataService } from '../services/masterDataService';

export const masterDataRouter = Router();

/**
 * GET /api/v1/customers
 * Read-only endpoint returning active customers with customer tier information.
 */
masterDataRouter.get(
  '/customers',
  authMiddleware(['SALES_REP', 'SALES_MANAGER']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const customers = await masterDataService.getAllCustomers();
      res.status(200).json(customers);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve master data customers.',
      });
    }
  }
);

/**
 * GET /api/v1/products
 * Read-only endpoint returning active catalog products with selling prices, costs, and categories.
 */
masterDataRouter.get(
  '/products',
  authMiddleware(['SALES_REP', 'SALES_MANAGER']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const products = await masterDataService.getAllProducts();
      res.status(200).json(products);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve master data products.',
      });
    }
  }
);
