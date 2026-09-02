import { Router } from 'express';
import * as bidController from '../controllers/bid.controller.js';
import * as documentController from '../controllers/document.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { uploadDocument } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  bidIdSchema,
  createBidSchema,
  listBidsSchema,
  updateBidSchema
} from '../validators/bid.validator.js';
import {
  documentBidIdSchema,
  documentIdSchema,
  uploadDocumentSchema
} from '../validators/document.validator.js';

export const bidRouter = Router();
export const documentRouter = Router();

bidRouter.use(authenticate);
bidRouter.get('/', validate(listBidsSchema), asyncHandler(bidController.index));
bidRouter.post('/', validate(createBidSchema), asyncHandler(bidController.create));
bidRouter.get('/:id', validate(bidIdSchema), asyncHandler(bidController.show));
bidRouter.put('/:id', validate(updateBidSchema), asyncHandler(bidController.update));
bidRouter.delete('/:id', validate(bidIdSchema), asyncHandler(bidController.remove));
bidRouter.get('/:bidId/documents', validate(documentBidIdSchema), asyncHandler(documentController.index));
bidRouter.post(
  '/:bidId/documents',
  uploadDocument,
  validate(uploadDocumentSchema),
  asyncHandler(documentController.upload)
);

documentRouter.use(authenticate);
documentRouter.get('/:id/download', validate(documentIdSchema), asyncHandler(documentController.download));
documentRouter.delete('/:id', validate(documentIdSchema), asyncHandler(documentController.remove));
