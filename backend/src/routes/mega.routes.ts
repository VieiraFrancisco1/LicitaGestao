import { Router } from 'express';
import * as controller from '../controllers/mega.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { uploadDocument } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  megaBrowseSchema,
  megaCompanyLinkSchema,
  megaDeleteSchema,
  megaFolderSchema,
  megaNodeSchema,
  megaRenameSchema,
  megaUploadSchema
} from '../validators/mega.validator.js';

export const megaRouter = Router();
megaRouter.use(authenticate);
megaRouter.get('/status', asyncHandler(controller.status));
megaRouter.get('/browse', validate(megaBrowseSchema), asyncHandler(controller.browse));
megaRouter.post('/folders', validate(megaFolderSchema), asyncHandler(controller.createFolder));
megaRouter.post('/upload', uploadDocument, validate(megaUploadSchema), asyncHandler(controller.upload));
megaRouter.patch('/nodes/:id', validate(megaRenameSchema), asyncHandler(controller.rename));
megaRouter.delete('/nodes/:id', validate(megaDeleteSchema), asyncHandler(controller.remove));
megaRouter.get('/nodes/:id/preview', validate(megaNodeSchema), asyncHandler(controller.preview));
megaRouter.get('/nodes/:id/download', validate(megaNodeSchema), asyncHandler(controller.download));
megaRouter.put('/companies/:companyId/link', validate(megaCompanyLinkSchema), asyncHandler(controller.linkCompany));
