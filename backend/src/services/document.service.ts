import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DocumentCategory } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyWriteAccess, type AuthScope } from './access.service.js';
import { getBid } from './bid.service.js';

const storageRoot = path.resolve(process.cwd(), env.STORAGE_PATH);

const allowedFiles: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.zip': ['application/zip', 'application/x-zip-compressed']
};

const resolveStoredPath = (relativePath: string) => {
  const fullPath = path.resolve(storageRoot, relativePath);
  if (fullPath !== storageRoot && !fullPath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new AppError('Caminho de documento inválido', 400);
  }
  return fullPath;
};

const assertAllowedFile = (file: Express.Multer.File) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedFiles[extension]?.includes(file.mimetype)) {
    throw new AppError('Tipo de arquivo não permitido', 422);
  }
  return extension;
};

export const listDocuments = async (bidId: string, auth: AuthScope) => {
  await getBid(bidId, auth);
  return prisma.document.findMany({
    where: { bidId },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  });
};

export const saveDocument = async (
  bidId: string,
  file: Express.Multer.File | undefined,
  category: DocumentCategory,
  auth: AuthScope
) => {
  if (!file) throw new AppError('Selecione um arquivo', 422);
  const bid = await getBid(bidId, auth);
  await assertCompanyWriteAccess(bid.companyId, auth);
  const extension = assertAllowedFile(file);
  const fileName = `${crypto.randomUUID()}${extension}`;
  const relativePath = path.join('companies', bid.companyId, 'bids', bid.id, fileName);
  const fullPath = resolveStoredPath(relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, file.buffer, { flag: 'wx' });
  try {
    return await prisma.document.create({
      data: {
        bidId,
        originalName: file.originalname.slice(0, 255),
        fileName,
        mimeType: file.mimetype,
        size: file.size,
        category,
        path: relativePath,
        uploadedById: auth.userId
      },
      include: { uploadedBy: { select: { id: true, name: true } } }
    });
  } catch (error) {
    await fs.unlink(fullPath).catch(() => undefined);
    throw error;
  }
};

export const getDocumentDownload = async (id: string, auth: AuthScope) => {
  const document = await prisma.document.findUnique({ where: { id }, include: { bid: true } });
  if (!document) throw new AppError('Documento não encontrado', 404);
  await getBid(document.bidId, auth);
  const fullPath = resolveStoredPath(document.path);
  try {
    await fs.access(fullPath);
  } catch {
    throw new AppError('Arquivo não encontrado no servidor', 404);
  }
  return { document, fullPath };
};

export const deleteDocument = async (id: string, auth: AuthScope) => {
  const { document, fullPath } = await getDocumentDownload(id, auth);
  await assertCompanyWriteAccess(document.bid.companyId, auth);
  await prisma.document.delete({ where: { id: document.id } });
  await fs.unlink(fullPath).catch(() => undefined);
};
