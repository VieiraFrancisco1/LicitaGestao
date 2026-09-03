import type { Request, Response } from 'express';
import {
  createCompany,
  getCompany,
  getCompanyDocuments,
  getCompanyPlatformSummary,
  listCompanyOptions,
  listCompanies,
  updateCompany
} from '../services/company.service.js';
import { AuditActions, recordAudit } from '../services/audit.service.js';

export const options = async (req: Request, res: Response) => {
  const items = await listCompanyOptions(req.auth!);
  res.json({ success: true, data: items });
};

export const index = async (req: Request, res: Response) => {
  const result = await listCompanies(req.query as unknown as Parameters<typeof listCompanies>[0], req.auth!);
  res.json({ success: true, data: result });
};

export const show = async (req: Request, res: Response) => {
  const company = await getCompany(req.params.id as string, req.auth!);
  res.json({ success: true, data: company });
};

export const create = async (req: Request, res: Response) => {
  const company = await createCompany(req.body);
  await recordAudit(req.auth!, {
    action: AuditActions.CREATE,
    entityType: 'COMPANY',
    entityId: company.id,
    entityLabel: company.tradeName || company.legalName,
    description: 'Empresa cadastrada'
  });
  res.status(201).json({ success: true, message: 'Empresa cadastrada', data: company });
};

export const update = async (req: Request, res: Response) => {
  await getCompany(req.params.id as string, req.auth!);
  const company = await updateCompany(req.params.id as string, req.body);
  await recordAudit(req.auth!, {
    action: AuditActions.UPDATE,
    entityType: 'COMPANY',
    entityId: company.id,
    entityLabel: company.tradeName || company.legalName,
    description: 'Empresa atualizada',
    metadata: { changedFields: Object.keys(req.body) }
  });
  res.json({ success: true, message: 'Empresa atualizada', data: company });
};

export const documents = async (req: Request, res: Response) => {
  const items = await getCompanyDocuments(req.params.id as string, req.auth!);
  res.json({ success: true, data: items });
};

export const platforms = async (req: Request, res: Response) => {
  const items = await getCompanyPlatformSummary(req.params.id as string, req.auth!);
  res.json({ success: true, data: items });
};
