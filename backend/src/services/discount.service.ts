import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyWriteAccess, requireOrganizationId, type AuthScope } from './access.service.js';

const includeDiscount = {
  tender: { include: { platform: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } }
} satisfies Prisma.DiscountCalculationInclude;

export const calculateDiscountPercentage = (
  globalValue: Prisma.Decimal.Value,
  discountedValue: Prisma.Decimal.Value
) => new Prisma.Decimal(globalValue).minus(discountedValue).dividedBy(globalValue).times(100).toDecimalPlaces(2);

const withPercentage = <T extends { discountedValue: Prisma.Decimal | null; tender: { estimatedValue: Prisma.Decimal | null } }>(item: T) => ({
  ...item,
  discountPercentage:
    item.discountedValue && item.tender.estimatedValue
      ? calculateDiscountPercentage(item.tender.estimatedValue, item.discountedValue)
      : null
});

const validateValue = (globalValue: Prisma.Decimal | null, discountedValue: number | null) => {
  if (!globalValue || globalValue.lessThanOrEqualTo(0)) throw new AppError('A licitação precisa possuir um valor global válido', 422);
  if (discountedValue !== null && new Prisma.Decimal(discountedValue).greaterThan(globalValue)) {
    throw new AppError('O valor com desconto não pode ser maior que o valor global', 422);
  }
};

export const listDiscounts = async (companyId: string, auth: AuthScope) => {
  await assertCompanyWriteAccess(companyId, auth);
  const items = await prisma.discountCalculation.findMany({
    where: { companyId, tender: { organizationId: requireOrganizationId(auth) } },
    include: includeDiscount,
    orderBy: { tender: { sessionDate: 'asc' } }
  });
  return items.map(withPercentage);
};

export const createDiscount = async (companyId: string, tenderId: string, auth: AuthScope) => {
  await assertCompanyWriteAccess(companyId, auth);
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, organizationId: requireOrganizationId(auth) },
    select: { estimatedValue: true }
  });
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);
  validateValue(tender.estimatedValue, null);
  try {
    const item = await prisma.discountCalculation.create({
      data: { companyId, tenderId, createdById: auth.userId, updatedById: auth.userId },
      include: includeDiscount
    });
    return withPercentage(item);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Esta licitação já foi adicionada às baixas da empresa', 409);
    }
    throw error;
  }
};

export const updateDiscount = async (companyId: string, id: string, discountedValue: number | null, auth: AuthScope) => {
  await assertCompanyWriteAccess(companyId, auth);
  const current = await prisma.discountCalculation.findFirst({
    where: { id, companyId, tender: { organizationId: requireOrganizationId(auth) } },
    include: { tender: { select: { estimatedValue: true } } }
  });
  if (!current) throw new AppError('Cálculo de baixa não encontrado', 404);
  validateValue(current.tender.estimatedValue, discountedValue);
  const item = await prisma.discountCalculation.update({
    where: { id },
    data: { discountedValue, updatedById: auth.userId },
    include: includeDiscount
  });
  return withPercentage(item);
};

export const deleteDiscount = async (companyId: string, id: string, auth: AuthScope) => {
  await assertCompanyWriteAccess(companyId, auth);
  const current = await prisma.discountCalculation.findFirst({
    where: { id, companyId, tender: { organizationId: requireOrganizationId(auth) } },
    select: { id: true }
  });
  if (!current) throw new AppError('Cálculo de baixa não encontrado', 404);
  await prisma.discountCalculation.delete({ where: { id } });
};
