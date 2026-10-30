// Read-only catalog snapshot for local association review. Does not modify the ERP.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createTinyClient } = require('../lib/tiny-sync.cjs');

async function main() {
  const envPath = process.argv[2] || path.join(__dirname, '..', '.env');
  const env = dotenv.parse(fs.readFileSync(envPath));
  const client = createTinyClient(env.TINY_API_TOKEN);
  const first = await client.productsPage(1);
  const products = [...first.products];
  for (let page = 2; page <= first.pages; page++) {
    const result = await client.productsPage(page);
    if (result.pages !== first.pages) throw new Error('Catálogo mudou durante consulta; repita.');
    products.push(...result.products);
    console.log(`Página ${page}/${first.pages}`);
  }
  const folder = path.join(__dirname, '..', 'private');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'tiny-catalog.json'), JSON.stringify({ readAt: new Date(), products }, null, 2));
  console.log(`Consulta concluída: ${products.length} produtos. Nenhuma alteração no Tiny.`);
}
main().catch(() => { console.error('Não foi possível consultar o catálogo. Nenhuma alteração realizada.'); process.exitCode = 1; });
