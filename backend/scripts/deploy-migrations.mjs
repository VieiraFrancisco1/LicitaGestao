/* global console, process, setTimeout */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve('prisma/build/index.js');

export const MAX_MIGRATION_ATTEMPTS = 4;
export const MIGRATION_RETRY_DELAYS_MS = [5_000, 10_000, 20_000];

export function isRetryableMigrationError(output) {
  return /P1002|advisory lock|timed out/i.test(output);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function runPrismaMigration() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let output = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      output += message;
      process.stderr.write(`${message}\n`);
      resolve({ exitCode: 1, output });
    });

    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, output });
    });
  });
}

export async function deployMigrations() {
  for (let attempt = 1; attempt <= MAX_MIGRATION_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      console.log(`Nova tentativa de migracao (${attempt}/${MAX_MIGRATION_ATTEMPTS})...`);
    }

    const result = await runPrismaMigration();

    if (result.exitCode === 0) {
      return 0;
    }

    const canRetry = attempt < MAX_MIGRATION_ATTEMPTS && isRetryableMigrationError(result.output);
    if (!canRetry) {
      return result.exitCode;
    }

    const delay = MIGRATION_RETRY_DELAYS_MS[attempt - 1] ?? 20_000;
    console.warn(`Banco temporariamente ocupado. Nova tentativa em ${delay / 1_000}s.`);
    await wait(delay);
  }

  return 1;
}

const entryFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryFile) {
  const exitCode = await deployMigrations();
  process.exitCode = exitCode;
}
