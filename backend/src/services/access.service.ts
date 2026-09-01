import { UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';

export type AuthScope = { userId: string; role: UserRole; companyId: string | null };

export async function assertCompanyPortalAccess(companyId: string, auth: AuthScope) {
  if (auth.role === UserRole.ADMIN) return;
  if (auth.role === UserRole.EMPRESA) {
    if (auth.companyId !== companyId) throw new AppError('Empresa não encontrada', 404);
    return;
  }
  const link = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId: auth.userId } },
    select: { companyId: true }
  });
  if (!link) throw new AppError('Você não está vinculado a esta empresa', 403);
}

export function scopedBidCompanyId(auth: AuthScope, requestedCompanyId?: string) {
  if (auth.role !== UserRole.EMPRESA) return requestedCompanyId;
  if (!auth.companyId) throw new AppError('Usuário sem empresa vinculada', 403);
  if (requestedCompanyId && requestedCompanyId !== auth.companyId) {
    throw new AppError('Empresa não encontrada', 404);
  }
  return auth.companyId;
}

export async function assertCompanyWriteAccess(companyId: string, auth: AuthScope) {
  if (auth.role === UserRole.ADMIN) return;
  if (auth.role === UserRole.EMPRESA) {
    if (auth.companyId !== companyId) throw new AppError('Empresa não encontrada', 404);
    return;
  }
  const link = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId: auth.userId } },
    select: { companyId: true }
  });
  if (!link) throw new AppError('Você não pode alterar dados desta empresa', 403);
}
