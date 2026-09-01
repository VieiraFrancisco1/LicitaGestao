import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/audit.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { listAuditSchema } from '../validators/audit.validator.js';

export const auditRouter = Router();
auditRouter.use(authenticate, authorize(UserRole.ADMIN));
auditRouter.get('/', validate(listAuditSchema), asyncHandler(controller.index));
