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
    description: 'Documento enviado',
    metadata: { bidId: document.bidId, category: document.category }
  });
  res.status(201).json({ success: true, message: 'Documento enviado', data: document });
};

export const download = async (req: Request, res: Response) => {
  const { document, fullPath } = await getDocumentDownload(req.params.id as string, req.auth!);
  res.download(fullPath, document.originalName);
};

export const remove = async (req: Request, res: Response) => {
  await deleteDocument(req.params.id as string, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.DELETE,
    entityType: 'DOCUMENT',
    entityId: req.params.id as string,
    description: 'Documento excluído'
  });
  res.json({ success: true, message: 'Documento excluído' });
};
