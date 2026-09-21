import type { Request, Response } from 'express';
import {
  addPriority,
  createAgendaItem,
  deleteAgendaItem,
  deleteOrganizationChatMessage,
  listAgenda,
  listCompanyChat,
  listOrganizationChat,
  listPriorities,
  removePriority,
  sendCompanyChatMessage,
  sendOrganizationChatMessage,
  updateAgendaItem
} from '../services/workspace.service.js';

export const agendaIndex = async (req: Request, res: Response) => {
  res.json({ success: true, data: await listAgenda(req.params.companyId as string, req.auth!) });
};

export const agendaCreate = async (req: Request, res: Response) => {
  const data = await createAgendaItem(req.params.companyId as string, req.body, req.auth!);
  res.status(201).json({ success: true, message: 'Item adicionado à agenda', data });
};

export const agendaUpdate = async (req: Request, res: Response) => {
  const data = await updateAgendaItem(
    req.params.companyId as string,
    req.params.itemId as string,
    req.body,
    req.auth!
  );
  res.json({ success: true, message: 'Agenda atualizada', data });
};

export const agendaDelete = async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: await deleteAgendaItem(
      req.params.companyId as string,
      req.params.itemId as string,
      req.auth!
    )
  });
};

export const priorityIndex = async (req: Request, res: Response) => {
  res.json({ success: true, data: await listPriorities(req.params.companyId as string, req.auth!) });
};

export const priorityCreate = async (req: Request, res: Response) => {
  const data = await addPriority(
    req.params.companyId as string,
    req.body.tenderId as string,
    req.auth!
  );
  res.status(201).json({ success: true, message: 'Licitação marcada como prioridade', data });
};

export const priorityDelete = async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: await removePriority(
      req.params.companyId as string,
      req.params.tenderId as string,
      req.auth!
    )
  });
};

export const chatIndex = async (req: Request, res: Response) => {
  res.json({ success: true, data: await listCompanyChat(req.params.companyId as string, req.auth!) });
};

export const chatCreate = async (req: Request, res: Response) => {
  const data = await sendCompanyChatMessage(req.params.companyId as string, req.body, req.auth!);
  res.status(201).json({ success: true, message: 'Mensagem enviada', data });
};


export const organizationChatIndex = async (req: Request, res: Response) => {
  res.json({ success: true, data: await listOrganizationChat(req.auth!) });
};

export const organizationChatCreate = async (req: Request, res: Response) => {
  const data = await sendOrganizationChatMessage(req.body, req.auth!);
  res.status(201).json({ success: true, message: 'Mensagem enviada', data });
};

export const organizationChatDelete = async (req: Request, res: Response) => {
  const data = await deleteOrganizationChatMessage(req.params.messageId as string, req.auth!);
  res.json({ success: true, message: 'Mensagem excluída', data });
};
