import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/platform.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createPlatformSchema,
  listPlatformsSchema,
  updatePlatformSchema
} from '../validators/platform.validator.js';

export const platformRouter = Router();
platformRouter.use(authenticate);
platformRouter.get('/', validate(listPlatformsSchema), asyncHandler(controller.index));
platformRouter.post(
  '/',
  authorize(UserRole.ADMIN),
  validate(createPlatformSchema),
  asyncHandler(controller.create)
);
platformRouter.put(
  '/:id',
  authorize(UserRole.ADMIN),
  validate(updatePlatformSchema),
  asyncHandler(controller.update)
);
