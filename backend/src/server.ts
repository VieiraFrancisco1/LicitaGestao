import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { startGmailPolling, stopGmailPolling } from './services/gmail.service.js';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`API disponível em http://0.0.0.0:${env.PORT}`);
  startGmailPolling();
});

const shutdown = async () => {
  stopGmailPolling();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
