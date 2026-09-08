import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const organizationName = process.env.ADMIN_ORGANIZATION_NAME?.trim() || 'LicitaGestão';

  if (!name || !email || !password || password.length < 12) {
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo de 12 caracteres) no .env');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const organization = await prisma.organization.upsert({
    where: { loginEmail: email },
    update: { name: organizationName, active: true },
    create: { name: organizationName, loginEmail: email, passwordHash, active: true }
  });

  await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email } },
    update: { name, passwordHash, active: true, role: UserRole.ADMIN, companyId: null },
    create: { organizationId: organization.id, name, email, passwordHash, role: UserRole.ADMIN }
  });
  console.log(`Organização e administrador preparados: ${organizationName} / ${email}`);

  const platforms = [
    'BLL Compras',
    'BNC Compras',
    'Compras.gov.br',
    'Licitanet',
    'Portal de Compras Públicas',
    'BBMNET Licitações'
  ];

  for (const name of platforms) {
    await prisma.platform.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: {},
      create: { organizationId: organization.id, name }
    });
  }
  console.log(`${platforms.length} plataformas padrão preparadas.`);
}

main().finally(() => prisma.$disconnect());
