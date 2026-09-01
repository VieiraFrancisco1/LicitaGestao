import { Router } from 'express';
import { prisma } from '../config/database.js';
import { authRouter } from './auth.routes.js';
import { companyRouter } from './company.routes.js';
import { userRouter } from './user.routes.js';
import { bidRouter, documentRouter } from './bid.routes.js';
import { platformRouter } from './platform.routes.js';
import { tenderRouter } from './tender.routes.js';
import { deadlineRouter } from './deadline.routes.js';
import { auditRouter } from './audit.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, data: { api: 'online', database: 'online' } });
  } catch {
    res.status(503).json({ success: false, message: 'API online, mas o banco de dados está indisponível' });
  }
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/companies', companyRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/platforms', platformRouter);
apiRouter.use('/tenders', tenderRouter);
apiRouter.use('/bids', bidRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/deadlines', deadlineRouter);
apiRouter.use('/audit', auditRouter);
