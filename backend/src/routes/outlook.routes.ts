import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/outlook.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { outlookCompanyIdSchema } from '../validators/outlook.validator.js';

export const outlookRouter = Router();

outlookRouter.get('/callback', asyncHandler(controller.callback));

outlookRouter.use(authenticate);
outlookRouter.use(authorize(UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA));

outlookRouter.get('/:companyId/status', validate(outlookCompanyIdSchema), asyncHandler(controller.status));
outlookRouter.get('/:companyId/auth-url', validate(outlookCompanyIdSchema), asyncHandler(controller.authUrl));
outlookRouter.post('/:companyId/sync', validate(outlookCompanyIdSchema), asyncHandler(controller.sync));
outlookRouter.delete('/:companyId', validate(outlookCompanyIdSchema), asyncHandler(controller.disconnect));
