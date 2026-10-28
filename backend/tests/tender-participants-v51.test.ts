import { UserRole } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/config/database.js';
import { createTender, listTenderCreationCompanies, listTenderParticipants } from '../src/services/tender.service.js';
import { listCompanyOptions } from '../src/services/company.service.js';
import { createBid } from '../src/services/bid.service.js';
import { resolveTenderWorkflowStatus } from '../src/utils/tender-workflow.js';
import { createTenderSchema, updateTenderSchema } from '../src/validators/tender.validator.js';

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompanyId = '22222222-2222-4222-8222-222222222222';
const tenderId = '33333333-3333-4333-8333-333333333333';
const auth = { userId: 'staff', role: UserRole.FUNCIONARIO, organizationId, companyId: null };
const input = { sessionDate: new Date('2026-10-28T00:00:00Z'), participantCompanyIds: [companyId] };

afterEach(() => vi.restoreAllMocks());

describe('empresas participantes no cadastro', () => {
  it('lista todas as empresas da conta somente na seleção do cadastro', async () => {
    const find = vi.spyOn(prisma.company, 'findMany').mockResolvedValue([]);
    await listTenderCreationCompanies(auth);
    expect(find.mock.calls[0]![0]!.where).toEqual({ organizationId });
    await listCompanyOptions(auth);
    expect(find.mock.calls[1]![0]!.where).toEqual({ organizationId, active: true, staffLinks: { some: { userId: auth.userId } } });
  });

  it('salva o cadastro e participações em uma escrita aninhada e elimina duplicatas', async () => {
    const find = vi.spyOn(prisma.company, 'findMany').mockResolvedValue([{ id: companyId }, { id: otherCompanyId }] as never);
    const create = vi.spyOn(prisma.tender, 'create').mockResolvedValue({ id: tenderId } as never);
    await createTender({ ...input, participantCompanyIds: [companyId, otherCompanyId, companyId] }, auth);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [companyId, otherCompanyId] }, organizationId, active: true } }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      organizationId, bids: { create: [companyId, otherCompanyId].map((id) => ({ companyId: id, createdById: auth.userId, updatedById: auth.userId })) }
    }) }));
    expect(create.mock.calls[0]![0]!.data).not.toHaveProperty('participantCompanyIds');
  });

  it('rejeita empresas de outra conta ou inativas antes de gravar', async () => {
    vi.spyOn(prisma.company, 'findMany').mockResolvedValue([]);
    const create = vi.spyOn(prisma.tender, 'create');
    await expect(createTender(input, auth)).rejects.toThrow('Selecione empresas ativas desta conta');
    expect(create).not.toHaveBeenCalled();
  });

  it('não libera a associação posterior a empresas não atribuídas ao funcionário', async () => {
    vi.spyOn(prisma.company, 'findFirst').mockResolvedValue({ id: otherCompanyId } as never);
    vi.spyOn(prisma.companyUser, 'findUnique').mockResolvedValue(null);
    await expect(createBid({ tenderId, companyId: otherCompanyId }, auth)).rejects.toThrow('Você não pode alterar dados desta empresa');
  });

  it('não expõe a seleção ampla no portal externo da empresa', async () => {
    const companyAuth = { ...auth, role: UserRole.EMPRESA, companyId };
    await expect(listTenderCreationCompanies(companyAuth)).rejects.toThrow('Seu perfil');
    await expect(createTender(input, companyAuth)).rejects.toThrow('Seu perfil');
  });

  it('aceita empresas no cadastro e rejeita essa mesma opção na edição', () => {
    const body = { sessionDate: '2026-10-28', participantCompanyIds: [companyId] };
    expect(createTenderSchema.safeParse({ body, params: {}, query: {} }).success).toBe(true);
    expect(updateTenderSchema.safeParse({ body, params: { id: tenderId }, query: {} }).success).toBe(false);
  });

  it('consulta participantes da licitação apenas na organização atual', async () => {
    const find = vi.spyOn(prisma.tender, 'findFirst').mockResolvedValue({ bids: [{ company: { id: companyId } }] } as never);
    expect(await listTenderParticipants(tenderId, auth)).toEqual([{ id: companyId }]);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: tenderId, organizationId } }));
  });
});

describe('início automático pelo dia da sessão, sem depender de anexação', () => {
  it.each([
    ['2026-10-29', 'PENDENTE'], ['2026-10-28', 'INICIADA'], ['2026-10-27', 'INICIADA']
  ])('classifica a sessão de %s como %s', (date, expected) => {
    expect(resolveTenderWorkflowStatus(new Date(`${date}T00:00:00Z`), null, '2026-10-28')).toBe(expected);
  });
  it('preserva suspensão, convocação e recurso identificados por e-mail', () => {
    expect(resolveTenderWorkflowStatus(input.sessionDate, 'SUSPENDED', '2026-10-28')).toBe('SUSPENSA');
    expect(resolveTenderWorkflowStatus(input.sessionDate, 'CONVOCATED', '2026-10-28')).toBe('CONVOCADA');
    expect(resolveTenderWorkflowStatus(input.sessionDate, 'RESOURCE', '2026-10-28')).toBe('RECURSO');
  });
});
