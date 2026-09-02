import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';
import {
  completeGmailOAuth,
  createGmailAuthorizationUrl,
  disconnectGmail,
  getGmailStatus,
  listCompanyEmailMessages,
  listGmailConvocationAlerts,
  markAllGmailConvocationsRead,
  markGmailConvocationRead,
  syncCompanyGmail
} from '../services/gmail.service.js';

export const status = async (req: Request, res: Response) => {
  const data = await getGmailStatus(req.params.companyId as string, req.auth!);
  res.json({ success: true, data });
};

export const authUrl = async (req: Request, res: Response) => {
  const url = await createGmailAuthorizationUrl(req.params.companyId as string, req.auth!);
  res.json({ success: true, data: { url } });
};

export const callback = async (req: Request, res: Response) => {
  const companyIdFromState = (() => {
    try {
      const raw = String(req.query.state ?? '').split('.')[0];
      return raw ? (JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { companyId?: string }).companyId : undefined;
    } catch {
      return undefined;
    }
  })();
  try {
    if (req.query.error) throw new Error(String(req.query.error));
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');
    if (!code || !state) throw new Error('Código OAuth ausente');
    const result = await completeGmailOAuth(code, state);
    await recordAudit(result.auth, {
      action: AuditActions.UPDATE,
      entityType: 'EMAIL_INTEGRATION',
      entityId: result.integrationId,
      entityLabel: result.email,
      description: 'Conta Google conectada à empresa',
      metadata: { companyId: result.companyId }
    });
    res.redirect(`${env.FRONTEND_URL}/empresas/${result.companyId}?tab=integrations&gmail=connected`);
  } catch (error) {
    console.error('Falha no callback OAuth do Gmail:', error);
    const destination = companyIdFromState ? `/empresas/${companyIdFromState}` : '/empresas';
    res.redirect(`${env.FRONTEND_URL}${destination}?tab=integrations&gmail=error`);
  }
};

export const disconnect = async (req: Request, res: Response) => {
  const companyId = req.params.companyId as string;
  const result = await disconnectGmail(companyId, req.auth!);
  if (result.disconnected) {
    await recordAudit(req.auth!, {
      action: AuditActions.DELETE,
      entityType: 'EMAIL_INTEGRATION',
      entityLabel: result.email ?? 'Gmail',
      description: 'Conta Google desconectada da empresa',
      metadata: { companyId }
    });
  }
  res.json({ success: true, message: 'Conta Google desconectada', data: result });
};

export const sync = async (req: Request, res: Response) => {
  const data = await syncCompanyGmail(req.params.companyId as string, req.auth!);
  res.json({ success: true, message: 'Sincronização concluída', data });
};

export const messages = async (req: Request, res: Response) => {
  const data = await listCompanyEmailMessages(
    req.params.companyId as string,
    req.auth!,
    req.query as unknown as { limit: number; convocationsOnly: boolean }
  );
  res.json({ success: true, data });
};

export const alerts = async (req: Request, res: Response) => {
  const data = await listGmailConvocationAlerts(req.auth!);
  res.json({ success: true, data });
};

export const readAlert = async (req: Request, res: Response) => {
  await markGmailConvocationRead(req.auth!, req.body.messageId);
  res.json({ success: true, message: 'Alerta marcado como lido' });
};

export const readAllAlerts = async (req: Request, res: Response) => {
  const data = await markAllGmailConvocationsRead(req.auth!);
  res.json({ success: true, data });
};
