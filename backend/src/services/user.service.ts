import bcrypt from 'bcryptjs';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { publicUser } from '../utils/public-user.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';

export type UserInput = {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  companyId?: string | null;
  companyIds?: string[];
  active?: boolean;
};

const ensureCompanyRule = (role: UserRole, companyId: string | null | undefined, companyIds: string[] = []) => {
  if (role === UserRole.EMPRESA && !companyId) throw new AppError('Usuário EMPRESA deve possuir uma empresa', 422);
  if (role !== UserRole.EMPRESA && companyId) throw new AppError('Somente usuário EMPRESA pode ser vinculado', 422);
  if (role !== UserRole.FUNCIONARIO && companyIds.length > 0)
    throw new AppError('Somente funcionário pode ser vinculado a várias empresas', 422);
};

async function assertCompaniesBelongToOrganization(
  organizationId: string,
  companyId: string | null | undefined,
  companyIds: string[]
) {
  const ids = [...new Set([...(companyId ? [companyId] : []), ...companyIds])];
  if (!ids.length) return;
  const count = await prisma.company.count({ where: { id: { in: ids }, organizationId } });
  if (count !== ids.length) throw new AppError('Uma ou mais empresas selecionadas não pertencem à sua organização', 422);
}

export const createUser = async (
  data: Required<Pick<UserInput, 'name' | 'email' | 'password' | 'role'>> & UserInput,
  auth: AuthScope
) => {
  const organizationId = requireOrganizationId(auth);
  const companyIds = [...new Set(data.companyIds ?? [])];
  ensureCompanyRule(data.role, data.companyId, companyIds);
  await assertCompaniesBelongToOrganization(organizationId, data.companyId, companyIds);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        organizationId,
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role,
        companyId: data.companyId ?? null,
        active: data.active ?? true
      }
    });
    if (data.role === UserRole.FUNCIONARIO && companyIds.length > 0) {
      await tx.companyUser.createMany({ data: companyIds.map((companyId) => ({ companyId, userId: created.id })) });
    }
    return tx.user.findUniqueOrThrow({
      where: { id: created.id },
      include: { organization: true, company: true, companyLinks: { include: { company: true } } }
    });
  });
  return publicUser(user);
};

export const updateUser = async (id: string, actorId: string, data: UserInput, auth: AuthScope) => {
  const organizationId = requireOrganizationId(auth);
  const current = await prisma.user.findFirst({
    where: { id, organizationId },
    include: { companyLinks: { select: { companyId: true } } }
  });
  if (!current) throw new AppError('Usuário não encontrado', 404);
  const role = data.role ?? current.role;
  const companyId = data.companyId !== undefined ? data.companyId : current.companyId;
  const companyIds = [...new Set(data.companyIds ?? current.companyLinks.map((link) => link.companyId))];
  ensureCompanyRule(role, companyId, companyIds);
  await assertCompaniesBelongToOrganization(organizationId, companyId, companyIds);
  if (id === actorId && data.active === false) throw new AppError('Você não pode desativar o próprio usuário', 422);
  if (id === actorId && data.role && data.role !== UserRole.ADMIN) {
    throw new AppError('Você não pode remover o próprio perfil de administrador', 422);
  }

  const user = await prisma.$transaction(async (tx) => {
    const passwordHash = data.password !== undefined ? await bcrypt.hash(data.password, 12) : undefined;
    await tx.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email.toLowerCase() } : {}),
        ...(passwordHash !== undefined ? { passwordHash, sessionVersion: { increment: 1 } } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        companyId: role === UserRole.EMPRESA ? companyId : null,
        ...(data.active !== undefined ? { active: data.active } : {})
      }
    });
    if (passwordHash !== undefined) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    if (data.companyIds !== undefined || data.role !== undefined) {
      await tx.companyUser.deleteMany({ where: { userId: id } });
      if (role === UserRole.FUNCIONARIO && companyIds.length > 0) {
        await tx.companyUser.createMany({ data: companyIds.map((linkedCompanyId) => ({ companyId: linkedCompanyId, userId: id })) });
      }
    }
    return tx.user.findUniqueOrThrow({
      where: { id },
      include: { organization: true, company: true, companyLinks: { include: { company: true } } }
    });
  });
  return publicUser(user);
};

export const getUser = async (id: string, auth: AuthScope) => {
  const user = await prisma.user.findFirst({
    where: { id, organizationId: requireOrganizationId(auth) },
    include: { organization: true, company: true, companyLinks: { include: { company: true } } }
  });
  if (!user) throw new AppError('Usuário não encontrado', 404);
  return publicUser(user);
};

export const listUsers = async (
  query: { search?: string; role?: UserRole; active?: string; companyId?: string; page: number; pageSize: number },
  auth: AuthScope
) => {
  const organizationId = requireOrganizationId(auth);
  const where: Prisma.UserWhereInput = {
    organizationId,
    ...(query.role ? { role: query.role } : {}),
    ...(query.active ? { active: query.active === 'true' } : {}),
    AND: [
      ...(query.companyId
        ? [{ OR: [{ companyId: query.companyId }, { companyLinks: { some: { companyId: query.companyId } } }] }]
        : []),
      ...(query.search
        ? [{
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } }
            ]
          }]
        : [])
    ]
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      include: { organization: true, company: true, companyLinks: { include: { company: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.user.count({ where })
  ]);
  return { items: users.map(publicUser), total, page: query.page, pageSize: query.pageSize, pages: Math.ceil(total / query.pageSize) };
};


export const resetUserPassword = async (id: string, newPassword: string, auth: AuthScope) => {
  const organizationId = requireOrganizationId(auth);
  const user = await prisma.user.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true, active: true }
  });
  if (!user) throw new AppError('Usuário não encontrado', 404);
  if (id === auth.userId) {
    throw new AppError('Use a opção Alterar minha senha para modificar a sua própria senha', 422);
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const revokedAt = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } }
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt }
    })
  ]);
  return user;
};
