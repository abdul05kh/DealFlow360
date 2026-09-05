import { Request, Response, NextFunction } from 'express';

export type UserRole = 'SALES_REP' | 'SALES_MANAGER' | 'OPERATIONS_MANAGER';

export interface DemoUserIdentity {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: DemoUserIdentity;
    }
  }
}

export const authMiddleware = (allowedRoles?: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roleHeader = req.header('X-Demo-Role');
    const userIdHeader = req.header('X-Demo-User-Id');

    const role = (roleHeader as UserRole) || 'SALES_REP';
    let defaultUserId = 'rep_1';
    if (role === 'SALES_MANAGER') defaultUserId = 'mgr_1';
    if (role === 'OPERATIONS_MANAGER') defaultUserId = 'ops_1';

    const userId = userIdHeader || defaultUserId;

    req.user = {
      id: userId,
      role: role,
    };

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Action requires one of the following roles: ${allowedRoles.join(', ')}. Current role: ${role}`,
      });
      return;
    }

    next();
  };
};
