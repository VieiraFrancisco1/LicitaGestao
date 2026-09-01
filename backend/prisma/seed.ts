import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password || password.length < 8) {
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo de 8 caracteres) no .env');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, active: true, role: UserRole.ADMIN, companyId: null },
    create: { name, email, passwordHash, role: UserRole.ADMIN }
  });
  console.log(`Administrador preparado: ${email}`);

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
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log(`${platforms.length} plataformas padrão preparadas.`);
}

main().finally(() => prisma.$disconnect());
