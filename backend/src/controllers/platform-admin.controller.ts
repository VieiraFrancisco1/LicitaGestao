import type { Request, Response } from 'express';
import { GmailAccessRequestStatus } from '@prisma/client';
import {
  deleteOrganizationPermanently,
  getPlatformOverview,
  getSupportSettings,
  listGmailAccessRequests,
  reviewGmailAccessRequest,
  setOrganizationActive,
  updateSupportSettings
} from '../services/platform-admin.service.js';

export const overview = async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getPlatformOverview() });
};

export const organizationStatus = async (req: Request, res: Response) => {
  const data = await setOrganizationActive(req.params.id as string, req.body.active, req.auth!);
  res.json({ success: true, message: data.active ? 'Organização ativada' : 'Organização suspensa', data });
};

export const removeOrganization = async (req: Request, res: Response) => {
  const data = await deleteOrganizationPermanently(
    req.params.id as string,
    req.body.confirmation,
    req.auth!
  );
  res.json({
    success: true,
    message: 'Organização apagada definitivamente',
    data
  });
}; // LICITAGESTAO_SUPERADMIN_DELETE_V22

export const gmailRequests = async (req: Request, res: Response) => {
  const status = req.query.status as GmailAccessRequestStatus | undefined;
  res.json({ success: true, data: await listGmailAccessRequests(status) });
};

export const reviewGmailRequest = async (req: Request, res: Response) => {
  const data = await reviewGmailAccessRequest(
    req.params.id as string,
    req.body.status,
    req.body.note ?? null,
    req.auth!
  );
  res.json({ success: true, message: 'Solicitação revisada', data });
};

export const support = async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getSupportSettings() });
};

export const updateSupport = async (req: Request, res: Response) => {
  const data = await updateSupportSettings(req.body.supportName, req.body.supportWhatsapp || null);
  res.json({ success: true, message: 'Contato de suporte atualizado', data });
};
