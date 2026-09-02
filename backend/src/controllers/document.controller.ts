import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import type { DocumentCategory } from '@prisma/client';
import {
  deleteDocument,
  getDocumentDownload,
  listDocuments,
  saveDocument
} from '../services/document.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';

export const index = async (req: Request, res: Response) => {
  const documents = await listDocuments(req.params.bidId as string, req.auth!);
  res.json({ success: true, data: documents });
};

export const upload = async (req: Request, res: Response) => {
  const document = await saveDocument(
    req.params.bidId as string,
    req.file,
    req.body.category as DocumentCategory,
    req.auth!
  );
  await recordAudit(req.auth!, {
    action: AuditActions.UPLOAD,
    entityType: 'DOCUMENT',
    entityId: document.id,
    entityLabel: document.originalName,
    description: 'Documento enviado ao MEGA',
    metadata: { bidId: document.bidId, category: document.category, provider: 'MEGA' }
  });
  res.status(201).json({ success: true, message: 'Documento enviado ao MEGA', data: document });
};

export const download = async (req: Request, res: Response) => {
  const payload = await getDocumentDownload(req.params.id as string, req.auth!);
  if (payload.mode === 'local') {
    res.download(payload.fullPath, payload.document.originalName);
    return;
  }

  res.attachment(payload.document.originalName);
  res.setHeader('Content-Type', payload.document.mimeType || 'application/octet-stream');
  if (payload.document.size) res.setHeader('Content-Length', String(payload.document.size));
  await pipeline(payload.stream as NodeJS.ReadableStream, res);
};

export const remove = async (req: Request, res: Response) => {
  await deleteDocument(req.params.id as string, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.DELETE,
    entityType: 'DOCUMENT',
    entityId: req.params.id as string,
    description: 'Documento excluído e movido para a lixeira do MEGA'
  });
  res.json({ success: true, message: 'Documento excluído' });
};
