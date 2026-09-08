import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createUserSchema,
  listUsersSchema,
  resetUserPasswordSchema,
  updateUserSchema,
  userIdSchema
} from '../validators/user.validator.js';

export const userRouter = Router();

userRouter.use(authenticate, authorize(UserRole.ADMIN));
userRouter.get('/', validate(listUsersSchema), asyncHandler(controller.index));
userRouter.get('/:id', validate(userIdSchema), asyncHandler(controller.show));
userRouter.post('/', validate(createUserSchema), asyncHandler(controller.create));
userRouter.post('/:id/reset-password', validate(resetUserPasswordSchema), asyncHandler(controller.resetPassword));
userRouter.put('/:id', validate(updateUserSchema), asyncHandler(controller.update));
