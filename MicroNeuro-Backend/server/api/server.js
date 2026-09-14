#!/usr/bin/env node
import { setGlobalDispatcher, Agent } from 'undici';
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
import 'dotenv/config';

await import('../utils/electronCompat.js');
const { createApp } = await import('./app.js');

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || '0.0.0.0';
const { app, store } = createApp();
const { startIntelligenceJobs } = await import('./intelligenceRoutes.js');
const intelligenceJobs = startIntelligenceJobs(store);

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set; using a process-local session signing key.');
}
if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_TENANT_ID) {
  console.warn('AZURE_CLIENT_ID and AZURE_TENANT_ID are not set; OAuth endpoints will return 503.');
}

const server = app.listen(port, host, () => {
  console.log(`Outlook REST API listening on http://${host}:${port}`);
});

const cleanup = async (signal) => {
  console.log(`Received ${signal}; shutting down.`);
  server.close(async () => {
    intelligenceJobs.stop();
    await store.cleanup(0);
    const { default: prisma } = await import('../../lib/prisma.js');
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
};
process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGINT', () => cleanup('SIGINT'));