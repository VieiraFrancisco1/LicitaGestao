import type { Request, Response } from 'express';
import { AuditActions, recordAudit } from '../services/audit.service.js';
import {
  buildProposalPdf,
  getProposalLetterContext,
  getProposalTemplate,
  importProposalPdfTemplate,
  saveProposalTemplate
} from '../services/proposal-letter.service.js';
import { AppError } from '../utils/app-error.js';

export const template = async (req: Request, res: Response) => {
  const data = await getProposalTemplate(String(req.query.municipality), req.query.state ? String(req.query.state) : null);
  res.json({ success: true, data });
};

export const saveTemplate = async (req: Request, res: Response) => {
  const item = await saveProposalTemplate(req.body, req.auth!);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'PROPOSAL_TEMPLATE',
    entityId: item.id,
    entityLabel: item.municipality,
    description: 'Modelo de Carta Proposta salvo',
    metadata: { municipality: item.municipality, state: item.state }
  });
  res.json({ success: true, message: 'Modelo da Carta Proposta salvo', data: item });
};


export const importPdfTemplate = async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('Selecione um PDF de Carta Proposta', 422);
  const item = await importProposalPdfTemplate(
    String(req.body.bidId),
    { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype },
    req.auth!
  );
  await recordAudit(req.auth!, {
    action: AuditActions.UPLOAD,
    entityType: 'PROPOSAL_TEMPLATE',
    entityId: item.id,
    entityLabel: item.municipality,
    description: 'Modelo de Carta Proposta importado de PDF',
    metadata: {
      municipality: item.municipality,
      state: item.state,
      sourceFileName: item.sourceFileName,
      detectedFields: item.detectedFields,
      warnings: item.warnings
    }
  });
  res.json({
    success: true,
    message: item.warnings.length
      ? 'PDF importado. Revise os campos que não foram identificados automaticamente.'
      : 'PDF importado e convertido em modelo com sucesso',
    data: item
  });
};

export const context = async (req: Request, res: Response) => {
  const data = await getProposalLetterContext(req.params.id as string, req.auth!);
  res.json({ success: true, data });
};

export const pdf = async (req: Request, res: Response) => {
  const data = await getProposalLetterContext(req.params.id as string, req.auth!);
  if (!data.canGenerate) {
    throw new AppError(`Preencha antes de gerar: ${data.missing.join(', ')}`, 422);
  }
  const pdfBuffer = buildProposalPdf(data.generatedText);
  const fileName = `carta-proposta-${data.values.municipio}-${data.values.numero_licitacao}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'carta-proposta'}.pdf"`);
  res.send(pdfBuffer);
};
