import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditService } from '../services/auditService';
import { z } from 'zod';

export const adminRouter = Router();

// Zod schemas for Admin Operator Management
const createOperatorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'CUSTOMER']),
  customerId: z.string().optional().nullable(),
}).strict();

const updateOperatorSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER', 'CUSTOMER']).optional(),
  isActive: z.boolean().optional(),
  customerId: z.string().optional().nullable(),
}).strict();

/**
 * GET /api/v1/admin/operators
 * Retrieves all operators and customers with operational metrics. Require ADMIN role.
 */
adminRouter.get(
  '/admin/operators',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        include: {
          customer: true,
          _count: {
            select: { quotesCreated: true, approvalActioned: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      const safeUsers = users.map((u: any) => ({
        id: u.id,
        firebaseUid: u.firebaseUid,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        customerId: u.customerId,
        customerName: u.customer?.name || null,
        metrics: {
          quotesCreated: u._count.quotesCreated,
          approvalsHandled: u._count.approvalActioned,
        },
      }));

      res.status(200).json(safeUsers);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve operator list.',
      });
    }
  }
);

/**
 * POST /api/v1/admin/operators
 * Creates a new operator or user record. Requires ADMIN role.
 */
adminRouter.post(
  '/admin/operators',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = createOperatorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid operator creation parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const { name, email, password, role, customerId } = parsed.data;
      const normalizedEmail = email.trim().toLowerCase();

      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Email address is already registered.',
        });
        return;
      }

      if (role === 'CUSTOMER' && !customerId) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'CustomerId is required when role is CUSTOMER.',
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          role,
          customerId: customerId || null,
          isActive: true,
          firebaseUid: null, // Left null for controlled one-time Firebase identity linking on first login
        },
      });

      await auditService.logAuditEvent({
        entityType: 'User',
        entityId: user.id,
        actorId: req.user?.id || 'admin_1',
        actorName: 'System Admin',
        action: 'CREATE_OPERATOR',
        newStateJson: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }),
      });

      res.status(201).json({
        id: user.id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        customerId: user.customerId,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);

/**
 * PATCH /api/v1/admin/operators/:userId
 * Edits an operator's role, name, or active status. Requires ADMIN role.
 */
adminRouter.patch(
  '/admin/operators/:userId',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = updateOperatorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid operator update parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const targetUserId = req.params.userId as string;
      const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!existing) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Operator not found.',
        });
        return;
      }

      // Prevent deactivating self (current logged-in admin)
      if (req.user?.id === targetUserId && parsed.data.isActive === false) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'System Administrator cannot deactivate their own active session.',
        });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: parsed.data,
      });

      await auditService.logAuditEvent({
        entityType: 'User',
        entityId: updated.id,
        actorId: req.user?.id || 'admin_1',
        actorName: 'System Admin',
        action: 'UPDATE_OPERATOR',
        previousStateJson: JSON.stringify(existing),
        newStateJson: JSON.stringify(updated),
      });

      res.status(200).json({
        id: updated.id,
        firebaseUid: updated.firebaseUid,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        customerId: updated.customerId,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/v1/admin/operators/:userId
 * Soft deactivates an operator (isActive = false). Requires ADMIN role.
 */
adminRouter.delete(
  '/admin/operators/:userId',
  authMiddleware(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const targetUserId = req.params.userId as string;
      const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!existing) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Operator not found.',
        });
        return;
      }

      if (req.user?.id === targetUserId) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'System Administrator cannot self-deactivate.',
        });
        return;
      }

      const deactivated = await prisma.user.update({
        where: { id: targetUserId },
        data: { isActive: false },
      });

      await auditService.logAuditEvent({
        entityType: 'User',
        entityId: deactivated.id,
        actorId: req.user?.id || 'admin_1',
        actorName: 'System Admin',
        action: 'DEACTIVATE_OPERATOR',
        previousStateJson: JSON.stringify(existing),
        newStateJson: JSON.stringify(deactivated),
      });

      res.status(200).json({
        id: deactivated.id,
        name: deactivated.name,
        email: deactivated.email,
        role: deactivated.role,
        isActive: false,
      });
    } catch (error: any) {
      res.status(400).json({
        error: error.name || 'BadRequest',
        message: error.message,
      });
    }
  }
);
