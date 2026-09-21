import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import * as controller from '../controllers/search.controller.js';
import { globalSearchSchema } from '../validators/search.validator.js';

export const searchRouter = Router();
searchRouter.use(authenticate);
searchRouter.get('/', validate(globalSearchSchema), asyncHandler(controller.index));
