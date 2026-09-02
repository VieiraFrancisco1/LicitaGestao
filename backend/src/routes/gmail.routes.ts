import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/gmail.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { gmailCompanyIdSchema, gmailLinkMessageSchema, gmailMessagesSchema, gmailReadAlertSchema } from '../validators/gmail.validator.js';

export const gmailRouter = Router();

gmailRouter.get('/callback', asyncHandler(controller.callback));

gmailRouter.use(authenticate);
gmailRouter.use(authorize(UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA));

gmailRouter.get('/alerts', asyncHandler(controller.alerts));
gmailRouter.post('/alerts/read', validate(gmailReadAlertSchema), asyncHandler(controller.readAlert));
gmailRouter.post('/alerts/read-all', asyncHandler(controller.readAllAlerts));
gmailRouter.put('/messages/:messageId/link', validate(gmailLinkMessageSchema), asyncHandler(controller.linkMessage));
gmailRouter.get('/:companyId/status', validate(gmailCompanyIdSchema), asyncHandler(controller.status));
gmailRouter.get('/:companyId/auth-url', validate(gmailCompanyIdSchema), asyncHandler(controller.authUrl));
gmailRouter.get('/:companyId/messages', validate(gmailMessagesSchema), asyncHandler(controller.messages));
gmailRouter.post('/:companyId/sync', validate(gmailCompanyIdSchema), asyncHandler(controller.sync));
gmailRouter.delete('/:companyId', validate(gmailCompanyIdSchema), asyncHandler(controller.disconnect));
