import fs from 'node:fs/promises';
import path from 'node:path';
import { DocumentCategory } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyWriteAccess, type AuthScope } from './access.service.js';
import { getBid } from './bid.service.js';
import { getMegaNodeById, removeMegaNodeById, saveBidFileToMega } from './mega.service.js';

const storageRoot = path.resolve(process.cwd(), env.STORAGE_PATH);

const allowedFiles: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
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
  assertAllowedFile(file);

  const remote = await saveBidFileToMega({
    companyId: bid.companyId,
    companyName: bid.company.tradeName || bid.company.legalName,
    municipality: bid.tender.municipality,
    sessionDate: bid.tender.sessionDate,
    noticeNumber: bid.tender.noticeNumber,
    processNumber: bid.tender.processNumber,
    bidId: bid.id,
    file
  });

  try {
    return await (prisma as any).document.create({
      data: {
        bidId,
        originalName: file.originalname.slice(0, 255),
        fileName: remote.fileName,
        mimeType: file.mimetype,
        size: file.size,
        category,
        path: remote.remotePath,
        storageProvider: 'MEGA',
        remoteNodeId: remote.nodeId,
        remotePath: remote.remotePath,
        uploadedById: auth.userId
      },
      include: { uploadedBy: { select: { id: true, name: true } } }
    });
  } catch (error) {
    await removeMegaNodeById(remote.nodeId).catch(() => undefined);
    throw error;
  }
};

export const getDocumentDownload = async (id: string, auth: AuthScope) => {
  const document = await (prisma as any).document.findUnique({ where: { id }, include: { bid: true } });
  if (!document) throw new AppError('Documento não encontrado', 404);
  await getBid(document.bidId, auth);

  if (document.storageProvider === 'MEGA' && document.remoteNodeId) {
    const node = await getMegaNodeById(document.remoteNodeId);
    if (node.directory) throw new AppError('Documento inválido no MEGA', 422);
    return {
      document,
      mode: 'mega' as const,
      stream: node.download({ forceHttps: true })
    };
  }

  const fullPath = resolveStoredPath(document.path);
  try {
    await fs.access(fullPath);
  } catch {
    throw new AppError('Arquivo antigo não está disponível neste servidor', 404);
  }
  return { document, mode: 'local' as const, fullPath };
};

export const deleteDocument = async (id: string, auth: AuthScope) => {
  const payload = await getDocumentDownload(id, auth);
  await assertCompanyWriteAccess(payload.document.bid.companyId, auth);

  if (payload.mode === 'mega' && payload.document.remoteNodeId) {
    await removeMegaNodeById(payload.document.remoteNodeId);
  }

  await prisma.document.delete({ where: { id: payload.document.id } });
  if (payload.mode === 'local') await fs.unlink(payload.fullPath).catch(() => undefined);
};
