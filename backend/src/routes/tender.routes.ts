import { Router } from 'express';
import * as bidController from '../controllers/bid.controller.js';
import * as tenderController from '../controllers/tender.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { associateTenderSchema } from '../validators/bid.validator.js';
import {
  createTenderSchema,
  listTendersSchema,
  spreadsheetNotesSchema,
  spreadsheetReadySchema,
  spreadsheetResponsibilitySchema,
  tenderIdSchema,
  tenderListStatusSchema,
  updateTenderSchema
} from '../validators/tender.validator.js';

export const tenderRouter = Router();

tenderRouter.use(authenticate);
tenderRouter.get('/', validate(listTendersSchema), asyncHandler(tenderController.index));
tenderRouter.post('/', validate(createTenderSchema), asyncHandler(tenderController.create));
tenderRouter.patch(
  '/:id/spreadsheet-ready',
  validate(spreadsheetReadySchema),
  asyncHandler(tenderController.spreadsheetReady)
);
tenderRouter.patch(
  '/:id/spreadsheet-responsibility',
  validate(spreadsheetResponsibilitySchema),
  asyncHandler(tenderController.spreadsheetResponsibility)
);
tenderRouter.patch(
  '/:id/spreadsheet-notes',
  validate(spreadsheetNotesSchema),
  asyncHandler(tenderController.spreadsheetNotes)
);
tenderRouter.patch(
  '/:id/list-status',
  validate(tenderListStatusSchema),
  asyncHandler(tenderController.listStatus)
);
tenderRouter.get('/:id', validate(tenderIdSchema), asyncHandler(tenderController.show));
tenderRouter.put('/:id', validate(updateTenderSchema), asyncHandler(tenderController.update));
tenderRouter.delete('/:id', validate(tenderIdSchema), asyncHandler(tenderController.remove));
tenderRouter.post(
  '/:id/participations',
  validate(associateTenderSchema),
  asyncHandler(bidController.createForTender)
);
