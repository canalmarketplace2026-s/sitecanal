export async function calculateShipping({destinationCep,subtotal,items}) {
  const token=process.env.MELHOR_ENVIO_TOKEN, from=process.env.MELHOR_ENVIO_FROM_CEP?.replace(/\D/g,''), to=String(destinationCep||'').replace(/\D/g,'');
  if (!token || from?.length!==8) throw new Error('Frete indisponível.');
  if(to.length!==8 || !items?.length) throw new Error('CEP ou carrinho inválido.');
  const products=items.map(p=>{
    if(![p.width,p.height,p.length,p.weight].every(v=>Number.isFinite(v)&&v>0)) throw new Error('Medidas de envio não confirmadas.');
    return {id:p.id,width:p.width,height:p.height,length:p.length,weight:p.weight,quantity:p.quantity,insurance_value:p.price};
  });
  const base=process.env.MELHOR_ENVIO_SANDBOX==='true'?'https://sandbox.melhorenvio.com.br':'https://melhorenvio.com.br';
  const r=await fetch(`${base}/api/v2/me/shipment/calculate`,{method:'POST',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`,'User-Agent':'CanalMarketplace/1.0 (site@canalmarketplace.com.br)'},body:JSON.stringify({from:{postal_code:from},to:{postal_code:to},products,options:{receipt:false,own_hand:false}})});
  if(!r.ok) throw new Error('Não foi possível consultar o frete.');
  const data=await r.json();
  if(!Array.isArray(data)) throw new Error('Frete inválido.');
  const quotes=data.filter(q=>!q.error&&Number.isFinite(Number(q.price))&&Number(q.price)>0).map(q=>{
    const free=process.env.FREE_SHIPPING_ENABLED==='true'&&subtotal>=199&&/pac|package/i.test(q.name);
    return {id:q.id,serviceId:q.id,name:q.name,company:q.company?.name,companyId:q.company?.id||null,price:free?0:Number(q.price),originalPrice:Number(q.price),deliveryTime:`${q.delivery_time} dias úteis`,isFree:free,quotedAt:new Date().toISOString(),packages:Array.isArray(q.packages)?q.packages:[]};
  });
  if(!quotes.length) throw new Error('Nenhuma entrega disponível.');
  return quotes;
}
