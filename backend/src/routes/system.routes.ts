import { UserRole } from '@prisma/client';
import { Router } from 'express';
import * as controller from '../controllers/system.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const systemRouter = Router();

systemRouter.use(authenticate, authorize(UserRole.ADMIN));
systemRouter.get('/health', asyncHandler(controller.health));

