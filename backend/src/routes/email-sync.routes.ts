import { UserRole } from '@prisma/client';
import { Router } from 'express';
import * as controller from '../controllers/email-sync.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const emailSyncRouter = Router();

emailSyncRouter.use(authenticate, authorize(UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA));
emailSyncRouter.post('/sync', asyncHandler(controller.syncAccessible));
