import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { loginSchema, signupSchema } from '../schemas/authSchema';
import { getUserById, loginUser, signupUser } from '../services/authService';

export const authRouter = Router();

// POST /api/v1/auth/signup
authRouter.post(
  '/auth/signup',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid signup input parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const result = await signupUser(parsed.data);
      res.status(201).json(result);
    } catch (err: any) {
      if (err.statusCode) {
        res.status(err.statusCode).json({
          error: err.statusCode === 403 ? 'Forbidden' : 'BadRequest',
          message: err.message,
        });
        return;
      }
      next(err);
    }
  }
);

// POST /api/v1/auth/login
authRouter.post(
  '/auth/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid login input parameters',
          details: parsed.error.issues,
        });
        return;
      }

      const result = await loginUser(parsed.data);
      res.status(200).json(result);
    } catch (err: any) {
      if (err.statusCode === 401) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
        return;
      }
      next(err);
    }
  }
);

// GET /api/v1/auth/me
authRouter.get(
  '/auth/me',
  authMiddleware(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const user = await getUserById(req.user.id);
      res.status(200).json({ user });
    } catch (err: any) {
      if (err.statusCode === 401 || err.statusCode === 404) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User account is deactivated or invalid',
        });
        return;
      }
      next(err);
    }
  }
);
