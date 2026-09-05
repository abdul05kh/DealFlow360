import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  createCustomerSchema,
  createCustomerTierSchema,
  createProductCategorySchema,
  createProductSchema,
  updateCustomerSchema,
  updateCustomerTierSchema,
  updateProductCategorySchema,
  updateProductSchema,
} from '../schemas/masterDataSchema';
import { auditService } from '../services/auditService';
import { masterDataService } from '../services/masterDataService';

export const masterDataRouter = Router();

// GET /api/v1/customers
masterDataRouter.get(
  '/customers',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'ADMIN';
      const customers = await masterDataService.getAllCustomers(includeInactive);
      res.status(200).json(customers);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve master data customers.',
      });
    }
  }
);

// POST /api/v1/customers (ADMIN only)
masterDataRouter.post(
  '/customers',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = createCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid customer creation parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const created = await masterDataService.createCustomer(parsed.data);

      await auditService.logAuditEvent({
        entityType: 'Customer',
        entityId: created.id,
        actorId: req.user?.id || 'admin',
        actorName: req.user?.id || 'System Admin',
        action: 'CREATE_CUSTOMER',
        newStateJson: JSON.stringify(created),
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
        message: error.message || 'Failed to create customer.',
      });
    }
  }
);

// PATCH /api/v1/customers/:id (ADMIN only)
masterDataRouter.patch(
  '/customers/:id',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const parsed = updateCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid customer update parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const existing = await masterDataService.getCustomerWithTier(id);
      const updated = await masterDataService.updateCustomer(id, parsed.data);

      await auditService.logAuditEvent({
        entityType: 'Customer',
        entityId: updated.id,
        actorId: req.user?.id || 'admin',
        actorName: req.user?.id || 'System Admin',
        action: 'UPDATE_CUSTOMER',
        previousStateJson: existing ? JSON.stringify(existing) : null,
        newStateJson: JSON.stringify(updated),
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.statusCode === 404 ? 'NotFound' : error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
        message: error.message || 'Failed to update customer.',
      });
    }
  }
);

// GET /api/v1/products
masterDataRouter.get(
  '/products',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'ADMIN';
      const products = await masterDataService.getAllProducts(includeInactive);
      res.status(200).json(products);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve master data products.',
      });
    }
  }
);

// POST /api/v1/products (ADMIN only)
masterDataRouter.post(
  '/products',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = createProductSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid product creation parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const created = await masterDataService.createProduct(parsed.data);

      await auditService.logAuditEvent({
        entityType: 'Product',
        entityId: created.id,
        actorId: req.user?.id || 'admin',
        actorName: req.user?.id || 'System Admin',
        action: 'CREATE_PRODUCT',
        newStateJson: JSON.stringify(created),
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
        message: error.message || 'Failed to create product.',
      });
    }
  }
);

// PATCH /api/v1/products/:id (ADMIN only)
masterDataRouter.patch(
  '/products/:id',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid product update parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const existing = await masterDataService.getProductWithCategory(id);
      const updated = await masterDataService.updateProduct(id, parsed.data);

      await auditService.logAuditEvent({
        entityType: 'Product',
        entityId: updated.id,
        actorId: req.user?.id || 'admin',
        actorName: req.user?.id || 'System Admin',
        action: 'UPDATE_PRODUCT',
        previousStateJson: existing ? JSON.stringify(existing) : null,
        newStateJson: JSON.stringify(updated),
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.statusCode === 404 ? 'NotFound' : error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
        message: error.message || 'Failed to update product.',
      });
    }
  }
);

// GET /api/v1/customer-tiers
masterDataRouter.get(
  '/customer-tiers',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'ADMIN';
      const tiers = await masterDataService.getAllCustomerTiers(includeInactive);
      res.status(200).json(tiers);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve customer tiers.',
      });
    }
  }
);

// POST /api/v1/customer-tiers (ADMIN only)
masterDataRouter.post(
  '/customer-tiers',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = createCustomerTierSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid customer tier creation parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const created = await masterDataService.createCustomerTier(parsed.data);

      await auditService.logAuditEvent({
        entityType: 'CustomerTier',
        entityId: created.id,
        actorId: req.user?.id || 'admin',
        actorName: req.user?.id || 'System Admin',
        action: 'CREATE_CUSTOMER_TIER',
        newStateJson: JSON.stringify(created),
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
        message: error.message || 'Failed to create customer tier.',
      });
    }
  }
);

// PATCH /api/v1/customer-tiers/:id (ADMIN only)
masterDataRouter.patch(
  '/customer-tiers/:id',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const parsed = updateCustomerTierSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid customer tier update parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const tiers = await masterDataService.getAllCustomerTiers(true);
      const existing = tiers.find((t) => t.id === id);
      const updated = await masterDataService.updateCustomerTier(id, parsed.data);

      await auditService.logAuditEvent({
        entityType: 'CustomerTier',
        entityId: updated.id,
        actorId: req.user?.id || 'admin',
        actorName: req.user?.id || 'System Admin',
        action: 'UPDATE_CUSTOMER_TIER',
        previousStateJson: existing ? JSON.stringify(existing) : null,
        newStateJson: JSON.stringify(updated),
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.statusCode === 404 ? 'NotFound' : error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
        message: error.message || 'Failed to update customer tier.',
      });
    }
  }
);

const deactivateCustomerTierHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const tiers = await masterDataService.getAllCustomerTiers(true);
    const existing = tiers.find((t) => t.id === id);
    const updated = await masterDataService.deactivateCustomerTier(id);

    await auditService.logAuditEvent({
      entityType: 'CustomerTier',
      entityId: updated.id,
      actorId: req.user?.id || 'admin',
      actorName: req.user?.id || 'System Admin',
      action: 'DEACTIVATE_CUSTOMER_TIER',
      previousStateJson: existing ? JSON.stringify(existing) : null,
      newStateJson: JSON.stringify(updated),
    });

    res.status(200).json(updated);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.statusCode === 404 ? 'NotFound' : error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
      message: error.message || 'Failed to deactivate customer tier.',
    });
  }
};

// DELETE /api/v1/customer-tiers/:id (ADMIN only - Soft Deactivation)
masterDataRouter.delete('/customer-tiers/:id', authMiddleware(['ADMIN']), deactivateCustomerTierHandler);

// POST /api/v1/customer-tiers/:id/deactivate (ADMIN only - Soft Deactivation)
masterDataRouter.post('/customer-tiers/:id/deactivate', authMiddleware(['ADMIN']), deactivateCustomerTierHandler);


// GET /api/v1/product-categories
masterDataRouter.get(
  '/product-categories',
  authMiddleware(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const categories = await masterDataService.getAllProductCategories();
      res.status(200).json(categories);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve product categories.',
      });
    }
  }
);

// POST /api/v1/product-categories (ADMIN only)
masterDataRouter.post(
  '/product-categories',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = createProductCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid product category creation parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const created = await masterDataService.createProductCategory(parsed.data);

      await auditService.logAuditEvent({
        entityType: 'ProductCategory',
        entityId: created.id,
        actorId: req.user?.id || 'admin',
        actorName: req.user?.id || 'System Admin',
        action: 'CREATE_PRODUCT_CATEGORY',
        newStateJson: JSON.stringify(created),
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
        message: error.message || 'Failed to create product category.',
      });
    }
  }
);

// PATCH /api/v1/product-categories/:id (ADMIN only)
masterDataRouter.patch(
  '/product-categories/:id',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const parsed = updateProductCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid product category update parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const categories = await masterDataService.getAllProductCategories();
      const existing = categories.find((c) => c.id === id);
      const updated = await masterDataService.updateProductCategory(id, parsed.data);

      await auditService.logAuditEvent({
        entityType: 'ProductCategory',
        entityId: updated.id,
        actorId: req.user?.id || 'admin',
        actorName: req.user?.id || 'System Admin',
        action: 'UPDATE_PRODUCT_CATEGORY',
        previousStateJson: existing ? JSON.stringify(existing) : null,
        newStateJson: JSON.stringify(updated),
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.statusCode === 404 ? 'NotFound' : error.statusCode === 400 ? 'BadRequest' : 'InternalServerError',
        message: error.message || 'Failed to update product category.',
      });
    }
  }
);
