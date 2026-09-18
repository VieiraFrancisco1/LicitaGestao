import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middlewares/error-handler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': [
          "'self'",
          'https://sdk.mercadopago.com'
        ],
        'connect-src': [
          "'self'",
          'https://api.mercadopago.com',
          'https://events.mercadopago.com',
          'https://*.mercadopago.com',
          'https://*.mercadopago.com.br'
        ],
        'frame-src': [
          "'self'",
          'https://*.mercadopago.com',
          'https://*.mercadopago.com.br'
        ],
        'img-src': [
          "'self'",
          'data:',
          'https://*.mercadopago.com',
          'https://*.mercadopago.com.br',
          'https://http2.mlstatic.com'
        ]
      }
    }
  })
); // LICITAGESTAO_MERCADOPAGO_CSP_V10
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', apiRouter);

if (env.NODE_ENV === 'production') {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(currentDir, '../../frontend/dist');

  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
      return;
    }
    next();
  });
}

app.use(notFound);
app.use(errorHandler);
