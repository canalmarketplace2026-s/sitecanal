import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/admin';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await requireAdmin(req);
    if (req.method === 'GET') {
      const products = await prisma.product.findMany({ orderBy: { name: 'asc' }, take: 500,
        select: { id: true, name: true, slug: true, tinyId: true, sku: true, price: true, stock: true, reservedStock: true, weight: true, width: true, height: true, length: true, active: true } });
      return res.json({ products });
    }
    return res.status(405).json({error:'Os produtos são gerenciados no Tiny. Atualize o ERP e sincronize o site.'});
  } catch (error) { return res.status(error.status || (error.code === 'P2002' ? 409 : 503)).json({ error: error.status ? error.message : error.code === 'P2002' ? 'Esse código Tiny ou SKU já está associado a outro produto.' : 'Não foi possível salvar. Tente novamente.' }); }
}
