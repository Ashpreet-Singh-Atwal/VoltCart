import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, isProd } from './config/env.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!isProd) app.use(morgan('dev'));

  app.use(attachUser);
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
