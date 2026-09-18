import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/platform-admin.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  gmailAccessRequestsQuerySchema,
  organizationStatusSchema,
  reviewGmailAccessRequestSchema,
  supportSettingsSchema
} from '../validators/platform-admin.validator.js';

export const platformAdminRouter = Router();
platformAdminRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN));
platformAdminRouter.get('/overview', asyncHandler(controller.overview));
platformAdminRouter.patch('/organizations/:id/status', validate(organizationStatusSchema), asyncHandler(controller.organizationStatus));
platformAdminRouter.get('/gmail-requests', validate(gmailAccessRequestsQuerySchema), asyncHandler(controller.gmailRequests));
platformAdminRouter.patch('/gmail-requests/:id', validate(reviewGmailAccessRequestSchema), asyncHandler(controller.reviewGmailRequest));
platformAdminRouter.get('/support', asyncHandler(controller.support));
platformAdminRouter.put('/support', validate(supportSettingsSchema), asyncHandler(controller.updateSupport));
