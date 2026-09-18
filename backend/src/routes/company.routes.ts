import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as controller from '../controllers/company.controller.js';
import * as discountController from '../controllers/discount.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  companyIdSchema,
  createCompanySchema,
  listCompaniesSchema,
  updateCompanySchema
} from '../validators/company.validator.js';
import {
  createDiscountSchema,
  deleteDiscountSchema,
  listDiscountsSchema,
  updateDiscountSchema
} from '../validators/discount.validator.js';

export const companyRouter = Router();

companyRouter.use(authenticate);
companyRouter.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  validate(listCompaniesSchema),
  asyncHandler(controller.index)
);
companyRouter.get(
  '/options',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  asyncHandler(controller.options)
);
companyRouter.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  validate(companyIdSchema),
  asyncHandler(controller.show)
);
companyRouter.get(
  '/:id/documents',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  validate(companyIdSchema),
  asyncHandler(controller.documents)
);
companyRouter.get(
  '/:id/platforms',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  validate(companyIdSchema),
  asyncHandler(controller.platforms)
);
companyRouter.get(
  '/:id/discounts',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  validate(listDiscountsSchema),
  asyncHandler(discountController.index)
);
companyRouter.post(
  '/:id/discounts',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  validate(createDiscountSchema),
  asyncHandler(discountController.create)
);
companyRouter.put(
  '/:id/discounts/:discountId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  validate(updateDiscountSchema),
  asyncHandler(discountController.update)
);
companyRouter.delete(
  '/:id/discounts/:discountId',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO, UserRole.EMPRESA),
  validate(deleteDiscountSchema),
  asyncHandler(discountController.remove)
);
companyRouter.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createCompanySchema),
  asyncHandler(controller.create)
);
companyRouter.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(updateCompanySchema),
  asyncHandler(controller.update)
);
