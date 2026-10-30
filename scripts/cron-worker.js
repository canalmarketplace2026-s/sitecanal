require('dotenv').config();
const cron = require('node-cron');
const { execFile } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { exportPaidOrders } = require('../lib/tiny-orders.cjs');
const { processPendingPayments } = require('../lib/payments.cjs');
const prisma = new PrismaClient();
let syncRunning = false, operationsRunning = false, stopping = false;

function triggerSync() {
  if (syncRunning || stopping) return;
  syncRunning = true;
  execFile(process.execPath, [path.join(__dirname, 'sync-tiny.js')], {
    cwd: path.join(__dirname, '..'), windowsHide: true, maxBuffer: 1024 * 1024,
  }, (error, stdout) => {
    syncRunning = false;
    if (stdout) console.log(stdout.trim());
    if (error) console.error('[WORKER] Sincronização não concluída. Confira os registros do Tiny.');
  });
}
async function triggerOperations() {
  if (operationsRunning || stopping) return;
  operationsRunning = true;
  try {
    if (process.env.ASAAS_API_KEY) console.log('[PAYMENT RECOVERY]', JSON.stringify(await processPendingPayments(prisma, { limit: 10 })));
    if (process.env.TINY_ENVIAR_PEDIDOS === 'true') console.log('[TINY ORDERS]', JSON.stringify(await exportPaidOrders(prisma, { limit: 10 })));
  } catch { console.error('[WORKER] Operação pendente não concluída; consultar painel e registros.'); }
  finally { operationsRunning = false; }
}
console.log('[WORKER] Estoque a cada 15 minutos; recuperação de pagamentos e pedidos a cada minuto. Sem sobreposição.');
triggerSync();
triggerOperations();
cron.schedule('*/15 * * * *', triggerSync, { timezone: 'America/Sao_Paulo' });
cron.schedule('* * * * *', triggerOperations, { timezone: 'America/Sao_Paulo' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  stopping = true;
  prisma.$disconnect().finally(() => process.exit(0));
});
