import { UserRole } from '@prisma/client';
import { Router } from 'express';
import * as controller from '../controllers/backup.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { uploadBackup } from '../middlewares/backup-upload.js';
import { asyncHandler } from '../utils/async-handler.js';

export const backupRouter = Router();

backupRouter.use(authenticate, authorize(UserRole.ADMIN));
backupRouter.get('/summary', asyncHandler(controller.summary));
backupRouter.get('/download', asyncHandler(controller.download));
backupRouter.post('/restore', uploadBackup, asyncHandler(controller.restore));
