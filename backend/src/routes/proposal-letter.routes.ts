import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/proposal-letter.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { proposalTemplateQuerySchema, saveProposalTemplateSchema } from '../validators/proposal-letter.validator.js';

export const proposalLetterRouter = Router();
proposalLetterRouter.use(authenticate);
proposalLetterRouter.get('/template', validate(proposalTemplateQuerySchema), asyncHandler(controller.template));
proposalLetterRouter.put(
  '/template',
  authorize(UserRole.ADMIN, UserRole.FUNCIONARIO),
  validate(saveProposalTemplateSchema),
  asyncHandler(controller.saveTemplate)
);
