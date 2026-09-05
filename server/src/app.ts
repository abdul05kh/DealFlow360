import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { healthRouter } from './routes/health.js';

export const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1', healthRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`DealFlow360 Backend running on port ${config.port} (${config.nodeEnv})`);
  });
}
