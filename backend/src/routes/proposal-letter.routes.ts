import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/proposal-letter.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { uploadDocument } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  importProposalPdfSchema,
  proposalTemplateQuerySchema,
  saveProposalTemplateSchema
} from '../validators/proposal-letter.validator.js';

export const proposalLetterRouter = Router();
proposalLetterRouter.use(authenticate);
proposalLetterRouter.get('/template', validate(proposalTemplateQuerySchema), asyncHandler(controller.template));
proposalLetterRouter.put(
  '/template',
  authorize(UserRole.ADMIN, UserRole.FUNCIONARIO),
  validate(saveProposalTemplateSchema),
  asyncHandler(controller.saveTemplate)
);

proposalLetterRouter.post(
  '/template/pdf',
  authorize(UserRole.ADMIN, UserRole.FUNCIONARIO),
  uploadDocument,
  validate(importProposalPdfSchema),
  asyncHandler(controller.importPdfTemplate)
);
