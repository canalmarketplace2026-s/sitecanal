const { refreshCartStock } = require('../../../lib/tiny-catalog.cjs');
import prisma from '../../../lib/prisma';
import {resolveCart} from '../../../lib/catalog';
import {calculateShipping} from '../../../lib/melhor-envio';
export default async function handler(req,res) {
 if(req.method!=='POST') return res.status(405).end();
 try {await refreshCartStock(prisma,req.body?.items);const {products,subtotal}=await resolveCart(prisma,req.body?.items); const quotes=await calculateShipping({destinationCep:req.body.cep,subtotal,items:products}); return res.json({success:true,quotes,subtotal});}
 catch {return res.status(503).json({error:'Frete indisponível. Confira os produtos e tente novamente.'});}
}
