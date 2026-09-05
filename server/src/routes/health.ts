import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req: Request, res: Response) => {
  try {
    // Ping DB
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'UP',
      service: 'DealFlow360 Commercial Governance Engine API',
      database: 'CONNECTED',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'DOWN',
      service: 'DealFlow360 API',
      database: 'DISCONNECTED',
      error: error.message,
    });
  }
});
