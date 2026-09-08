import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  changePasswordSchema,
  forgotOrganizationPasswordSchema,
  memberLoginSchema,
  organizationLoginSchema,
  resetOrganizationPasswordSchema
} from '../validators/auth.validator.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas. Tente novamente em alguns minutos.' }
});

const recoveryLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Muitas solicitações de recuperação. Tente novamente mais tarde.' }
});

authRouter.post('/organization-login', loginLimiter, validate(organizationLoginSchema), asyncHandler(controller.organizationLogin));
authRouter.post('/member-login', loginLimiter, validate(memberLoginSchema), asyncHandler(controller.memberLogin));
authRouter.post('/forgot-password', recoveryLimiter, validate(forgotOrganizationPasswordSchema), asyncHandler(controller.forgotOrganizationPassword));
authRouter.post('/reset-password', recoveryLimiter, validate(resetOrganizationPasswordSchema), asyncHandler(controller.resetOrganizationPassword));
authRouter.post('/refresh', asyncHandler(controller.refresh));
authRouter.post('/logout', asyncHandler(controller.logout));
authRouter.get('/me', authenticate, asyncHandler(controller.me));
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(controller.changePassword));
