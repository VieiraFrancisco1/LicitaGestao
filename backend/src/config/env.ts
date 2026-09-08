import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  FRONTEND_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  ORGANIZATION_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(10).max(120).default(30),
  STORAGE_PATH: z.string().min(1).default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(25),

  // Compatibilidade com documentos antigos armazenados na conta global.
  MEGA_EMAIL: z.string().email().optional(),
  MEGA_PASSWORD: z.string().min(1).optional(),
  MEGA_ROOT_FOLDER: z.string().trim().default(''),
  MEGA_TENDERS_FOLDER: z.string().trim().min(1).default('LICITAÇÕES'),
  // Chave usada para proteger as credenciais MEGA individuais dos usuários.
  MEGA_CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),

  // E-mail transacional para recuperação da senha principal da organização.
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  PASSWORD_RESET_FROM: z.string().trim().min(3).optional(),

  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_OAUTH_STATE_SECRET: z.string().min(32).optional(),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  GMAIL_POLL_INTERVAL_MS: z.coerce.number().int().min(60_000).max(120_000).default(90_000),
  MICROSOFT_CLIENT_ID: z.string().trim().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().trim().min(1).optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_OAUTH_STATE_SECRET: z.string().min(32).optional(),
  MICROSOFT_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  OUTLOOK_POLL_INTERVAL_MS: z.coerce.number().int().min(60_000).max(900_000).default(120_000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  throw new Error('Não foi possível carregar a configuração do servidor.');
}

export const env = parsed.data;
