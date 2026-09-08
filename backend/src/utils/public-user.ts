import type { Company, Organization, User } from '@prisma/client';

type UserWithCompany = User & {
  organization?: Organization;
  company?: Company | null;
  companyLinks?: Array<{ company: Company }>;
};

export const publicUser = (user: UserWithCompany) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  organizationId: user.organizationId,
  organization: user.organization ? { id: user.organization.id, name: user.organization.name } : null,
  companyId: user.companyId,
  company: user.company
    ? { id: user.company.id, legalName: user.company.legalName, tradeName: user.company.tradeName }
    : null,
  assignedCompanies: (user.companyLinks ?? []).map(({ company }) => ({
    id: company.id,
    legalName: company.legalName,
    tradeName: company.tradeName,
    active: company.active
  })),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
