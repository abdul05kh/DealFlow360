import { Request, Response, NextFunction } from 'express';

export interface DemoUserIdentity {
  id: string;
  role: 'SALES_REP' | 'SALES_MANAGER';
}

declare global {
  namespace Express {
    interface Request {
      user?: DemoUserIdentity;
    }
  }
}

export const authMiddleware = (allowedRoles?: ('SALES_REP' | 'SALES_MANAGER')[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roleHeader = req.header('X-Demo-Role');
    const userIdHeader = req.header('X-Demo-User-Id');

    const role = (roleHeader as 'SALES_REP' | 'SALES_MANAGER') || 'SALES_REP';
    const userId = userIdHeader || (role === 'SALES_MANAGER' ? 'mgr_1' : 'rep_1');

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
