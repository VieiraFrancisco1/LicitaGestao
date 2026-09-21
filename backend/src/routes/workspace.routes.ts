import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import * as controller from '../controllers/workspace.controller.js';
import {
  agendaCreateSchema,
  agendaDeleteSchema,
  agendaUpdateSchema,
  chatCreateSchema,
  organizationChatCreateSchema,
  organizationChatDeleteSchema,
  organizationChatSchema,
  priorityCreateSchema,
  priorityDeleteSchema,
  workspaceCompanySchema
} from '../validators/workspace.validator.js';

export const workspaceRouter = Router();
workspaceRouter.use(authenticate);

workspaceRouter.get('/chat', validate(organizationChatSchema), asyncHandler(controller.organizationChatIndex));
workspaceRouter.post('/chat', validate(organizationChatCreateSchema), asyncHandler(controller.organizationChatCreate));
workspaceRouter.delete('/chat/:messageId', validate(organizationChatDeleteSchema), asyncHandler(controller.organizationChatDelete));

workspaceRouter.get('/:companyId/agenda', validate(workspaceCompanySchema), asyncHandler(controller.agendaIndex));
workspaceRouter.post('/:companyId/agenda', validate(agendaCreateSchema), asyncHandler(controller.agendaCreate));
workspaceRouter.put('/:companyId/agenda/:itemId', validate(agendaUpdateSchema), asyncHandler(controller.agendaUpdate));
workspaceRouter.delete('/:companyId/agenda/:itemId', validate(agendaDeleteSchema), asyncHandler(controller.agendaDelete));

workspaceRouter.get('/:companyId/priorities', validate(workspaceCompanySchema), asyncHandler(controller.priorityIndex));
workspaceRouter.post('/:companyId/priorities', validate(priorityCreateSchema), asyncHandler(controller.priorityCreate));
workspaceRouter.delete(
  '/:companyId/priorities/:tenderId',
  validate(priorityDeleteSchema),
  asyncHandler(controller.priorityDelete)
);

workspaceRouter.get('/:companyId/chat', validate(workspaceCompanySchema), asyncHandler(controller.chatIndex));
workspaceRouter.post('/:companyId/chat', validate(chatCreateSchema), asyncHandler(controller.chatCreate));
