import cors from 'cors';
import express from 'express';
import { config } from './config/index';
import { authRouter } from './routes/authRoutes';
import { fulfillmentRouter } from './routes/fulfillmentRoutes';
import { healthRouter } from './routes/health';
import { masterDataRouter } from './routes/masterDataRoutes';
import { quoteRouter } from './routes/quoteRoutes';

export const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1', healthRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', masterDataRouter);
app.use('/api/v1', fulfillmentRouter);
app.use('/api/v1/quotes', quoteRouter);

// Safe Global Error Handler (No stack trace or internal database leaks exposed)
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = err.status || err.statusCode || 500;
    const errorName = err.name || 'InternalServerError';

    res.status(status).json({
      error: errorName,
      message:
        status === 500
          ? 'An internal server error occurred.'
          : err.message || 'Request failed.',
    });
  }
);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(
      `DealFlow360 Backend running on port ${config.port} (${config.nodeEnv})`
    );
  });
}
