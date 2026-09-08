import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import {
  browseMega,
  connectMegaAccount,
  createMegaFolder,
  deleteMegaNode,
  disconnectMegaAccount,
  getMegaDownload,
  getMegaStatus,
  linkCompanyFolder,
  renameMegaNode,
  syncMegaAccount,
  uploadMegaFile
} from '../services/mega.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';
import { safeResponseFileName } from '../services/file-security.service.js';

const previewMime = (name: string) => {
  const extension = path.extname(name).toLowerCase();
  const allowed: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  };
  return allowed[extension] ?? null;
};

export const status = async (req: Request, res: Response) => {
  const data = await getMegaStatus(req.auth!);
  res.json({ success: true, data });
};

export const connectAccount = async (req: Request, res: Response) => {
  const data = await connectMegaAccount(req.auth!, req.body.email, req.body.password);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'USER_MEGA_INTEGRATION',
    entityId: req.auth!.userId,
    description: 'Conta individual do MEGA conectada'
  });
  res.json({ success: true, message: 'Conta do MEGA conectada e sincronizada.', data });
};

export const syncAccount = async (req: Request, res: Response) => {
  const data = await syncMegaAccount(req.auth!);
  res.json({ success: true, message: 'Conta do MEGA sincronizada.', data });
};

export const disconnectAccount = async (req: Request, res: Response) => {
  await disconnectMegaAccount(req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'USER_MEGA_INTEGRATION',
    entityId: req.auth!.userId,
    description: 'Conta individual do MEGA desconectada'
  });
  res.json({ success: true, message: 'Conta do MEGA desconectada deste usuário.' });
};

export const browse = async (req: Request, res: Response) => {
  const query = req.query as unknown as { companyId?: string; path?: string; refresh?: boolean };
  const data = await browseMega(req.auth!, query);
  res.json({ success: true, data });
};

export const upload = async (req: Request, res: Response) => {
  const data = await uploadMegaFile(req.auth!, req.body.companyId, req.body.path, req.file);
  await recordAudit(req.auth!, {
    action: AuditActions.UPLOAD,
    entityType: 'MEGA_FILE',
    entityId: data.id,
    entityLabel: data.name,
    description: 'Arquivo enviado ao MEGA individual do usuário',
    metadata: { companyId: req.body.companyId ?? null, path: req.body.path ?? '' }
  });
  res.status(201).json({ success: true, message: 'Arquivo enviado ao MEGA', data });
};

export const createFolder = async (req: Request, res: Response) => {
  const data = await createMegaFolder(req.auth!, req.body.companyId, req.body.path, req.body.name);
  await recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'MEGA_FOLDER',
    entityId: data.id,
    entityLabel: data.name,
    description: 'Pasta criada no MEGA individual do usuário',
    metadata: { companyId: req.body.companyId ?? null, path: req.body.path ?? '' }
  });
  res.status(201).json({ success: true, message: 'Pasta criada', data });
};

export const rename = async (req: Request, res: Response) => {
  const data = await renameMegaNode(req.auth!, req.body.companyId, req.params.id as string, req.body.name);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'MEGA_NODE',
    entityId: data.id,
    entityLabel: data.name,
    description: 'Arquivo ou pasta renomeado no MEGA',
    metadata: { companyId: req.body.companyId ?? null }
  });
  res.json({ success: true, message: 'Item renomeado', data });
};

export const remove = async (req: Request, res: Response) => {
  const companyId = (req.query as { companyId?: string }).companyId;
  const data = await deleteMegaNode(req.auth!, companyId, req.params.id as string);
  await recordAudit(req.auth!, {
    action: AuditActions.DELETE,
    entityType: data.type === 'folder' ? 'MEGA_FOLDER' : 'MEGA_FILE',
    entityId: data.id,
    entityLabel: data.name,
    description: 'Item movido para a lixeira do MEGA',
    metadata: { companyId: companyId ?? null }
  });
  res.json({ success: true, message: 'Item movido para a lixeira do MEGA' });
};

export const download = async (req: Request, res: Response) => {
  const companyId = (req.query as { companyId?: string }).companyId;
  const data = await getMegaDownload(req.auth!, companyId, req.params.id as string);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.attachment(safeResponseFileName(data.name));
  res.setHeader('Content-Type', 'application/octet-stream');
  if (data.size) res.setHeader('Content-Length', String(data.size));
  await pipeline(data.stream as NodeJS.ReadableStream, res);
};

export const linkCompany = async (req: Request, res: Response) => {
  const data = await linkCompanyFolder(req.params.companyId as string, req.body.path, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'COMPANY_MEGA_FOLDER',
    entityId: req.params.companyId as string,
    description: 'Pasta da empresa vinculada ao MEGA individual do usuário',
    metadata: { megaFolderPath: data.megaFolderPath }
  });
  res.json({ success: true, message: 'Pasta vinculada à sua conta do MEGA', data });
};

export const preview = async (req: Request, res: Response) => {
  const companyId = (req.query as { companyId?: string }).companyId;
  const data = await getMegaDownload(req.auth!, companyId, req.params.id as string);
  const mime = previewMime(data.name);
  if (!mime) {
    res.status(415).json({
      success: false,
      message: 'Pré-visualização disponível apenas para PDF, PNG e JPG'
    });
    return;
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', mime);
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(safeResponseFileName(data.name))}`
  );
  if (data.size) res.setHeader('Content-Length', String(data.size));
  await pipeline(data.stream as NodeJS.ReadableStream, res);
};
