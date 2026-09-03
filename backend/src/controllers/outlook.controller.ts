import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';
import {
  completeOutlookOAuth,
  createOutlookAuthorizationUrl,
  disconnectOutlook,
  getOutlookStatus,
  syncCompanyOutlook
} from '../services/outlook.service.js';

export const status = async (req: Request, res: Response) => {
  const data = await getOutlookStatus(req.params.companyId as string, req.auth!);
  res.json({ success: true, data });
};

export const authUrl = async (req: Request, res: Response) => {
  const url = await createOutlookAuthorizationUrl(req.params.companyId as string, req.auth!);
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
    if (req.query.error) throw new Error(String(req.query.error_description ?? req.query.error));
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');
    if (!code || !state) throw new Error('Código OAuth ausente');

    const result = await completeOutlookOAuth(code, state);
    await recordAudit(result.auth, {
      action: AuditActions.UPDATE,
      entityType: 'OUTLOOK_INTEGRATION',
      entityId: result.integrationId,
      entityLabel: result.email,
      description: 'Conta Microsoft conectada à empresa',
      metadata: { companyId: result.companyId }
    });
    res.redirect(`${env.FRONTEND_URL}/empresas/${result.companyId}?tab=integrations&outlook=connected`);
  } catch (error) {
    console.error('Falha no callback OAuth do Outlook:', error);
    const destination = companyIdFromState ? `/empresas/${companyIdFromState}` : '/empresas';
    res.redirect(`${env.FRONTEND_URL}${destination}?tab=integrations&outlook=error`);
  }
};

export const disconnect = async (req: Request, res: Response) => {
  const companyId = req.params.companyId as string;
  const result = await disconnectOutlook(companyId, req.auth!);
  if (result.disconnected) {
    await recordAudit(req.auth!, {
      action: AuditActions.DELETE,
      entityType: 'OUTLOOK_INTEGRATION',
      entityLabel: result.email ?? 'Outlook',
      description: 'Conta Microsoft desconectada da empresa',
      metadata: { companyId }
    });
  }
  res.json({ success: true, message: 'Conta Microsoft desconectada', data: result });
};

export const sync = async (req: Request, res: Response) => {
  const data = await syncCompanyOutlook(req.params.companyId as string, req.auth!);
  res.json({ success: true, message: 'Sincronização concluída', data });
};
