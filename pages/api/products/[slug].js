import prisma from '../../../lib/prisma';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const product = await prisma.product.findFirst({ where: { slug: String(req.query.slug), active: true } });
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.json({ ...product, stock: Math.max(0, product.stock - product.reservedStock) });
  } catch { return res.status(503).json({ error: 'Catálogo temporariamente indisponível.' }); }
}
