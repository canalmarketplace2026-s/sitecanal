require('dotenv').config();

const errors = [];
const required = name => { if (!process.env[name] || /USUARIO|SENHA|COLE_/.test(process.env[name])) errors.push(`${name}: configurar no servidor.`); };
for (const name of ['DATABASE_URL', 'TINY_API_TOKEN', 'MELHOR_ENVIO_TOKEN']) required(name);
for (const name of ['JWT_SECRET', 'CRON_SECRET', 'ASAAS_WEBHOOK_TOKEN']) {
  const value = process.env[name];
  if (!value || value.length < 32 || /canal_.*2026/.test(value)) errors.push(`${name}: precisa de segredo exclusivo, aleatório, com pelo menos 32 caracteres.`);
}
if (!/^\d{8}$/.test(process.env.MELHOR_ENVIO_FROM_CEP || '')) errors.push('MELHOR_ENVIO_FROM_CEP: informar oito dígitos.');
if (!['https://api-sandbox.asaas.com/v3', 'https://api.asaas.com/v3'].includes(process.env.ASAAS_API_URL)) errors.push('ASAAS_API_URL: usar o ambiente oficial de testes ou produção.');
if (process.env.CHECKOUT_ENABLED === 'true') {
  errors.push('CHECKOUT_ENABLED: a liberação depende da homologação e conciliação descritas em DEPLOY.md; esta entrega de preparação deve permanecer false.');
}
console.log('Verificação local de configuração; nenhuma conexão foi realizada e nenhum segredo é exibido.');
if (errors.length) { for (const error of errors) console.error(`- ${error}`); process.exitCode = 1; }
else console.log('Configuração básica presente. Isso não comprova funcionamento das integrações nem autoriza liberar compras.');
