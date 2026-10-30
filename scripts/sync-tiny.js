require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { syncTiny } = require('../lib/tiny-sync.cjs');
const prisma = new PrismaClient();

async function main() {
  const result = await syncTiny(prisma);
  console.log('[TINY SYNC]', JSON.stringify(result));
  if (!result.success && !result.busy) process.exitCode = 1;
}
main().catch(() => {
  console.error('[TINY SYNC] Falha; consulte o registro de sincronização no banco.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
