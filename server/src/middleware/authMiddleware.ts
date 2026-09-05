import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index';
import { verifyToken } from '../services/authService';

export type UserRole =
  | 'SALES_REP'
  | 'SALES_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'ADMIN'
  | 'CUSTOMER';

export interface AuthenticatedUserIdentity {
  id: string;
  role: UserRole;
  customerId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserIdentity;
    }
  }
}

export const authMiddleware = (allowedRoles?: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = verifyToken(token);
        req.user = {
          id: decoded.userId,
          role: decoded.role as UserRole,
          customerId: decoded.customerId,
        };
      } catch (err) {
        // Invalid or expired token MUST NOT fall back to demo headers.
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        });
        return;
      }
    } else {
      // No Authorization header provided
      const isProduction = config.nodeEnv === 'production';
      if (isProduction) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication token required in production mode',
        });
        return;
      }

      // Development / Test mode demo header fallback
      const roleHeader = req.header('X-Demo-Role');
      const userIdHeader = req.header('X-Demo-User-Id');

      const role = (roleHeader as UserRole) || 'SALES_REP';
      let defaultUserId = 'rep_1';
      if (role === 'SALES_MANAGER') defaultUserId = 'mgr_1';
      if (role === 'OPERATIONS_MANAGER') defaultUserId = 'ops_1';
      if (role === 'ADMIN') defaultUserId = 'admin_1';

      const userId = userIdHeader || defaultUserId;

      req.user = {
        id: userId,
        role: role,
      };
    }

    if (allowedRoles && allowedRoles.length > 0 && req.user) {
      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Action requires one of the following roles: ${allowedRoles.join(', ')}. Current role: ${req.user.role}`,
        });
        return;
      }
    }

    next();
  };
};
