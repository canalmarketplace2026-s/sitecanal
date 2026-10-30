const test=require('node:test'),assert=require('node:assert/strict');
const {baseProduct,detailProduct,priceOf,readCatalog,applyCatalog,refreshCartStock}=require('../lib/tiny-catalog.cjs');
test('official catalog uses Tiny identities and actual promotional price, never local sequence',()=>{
 const p=baseProduct({id:'123',nome:'Real',codigo:'DUP',preco:100,preco_promocional:80,situacao:'A'},new Map([['DUP',2]]));
 assert.equal(p.slug,'tiny-123');assert.equal(p.tinyId,'123');assert.equal(p.price,80);assert.equal(p.sku,null);assert.equal(p.active,true);
 assert.equal(baseProduct({id:'1',nome:'Pai',preco:100,situacao:'A',tipoVariacao:'P'},new Map()).active,false);
 assert.equal(priceOf({preco:0,preco_promocional:20}),0);
});
test('Tiny details use actual package measurements, images and plain description',()=>{
 const d=detailProduct({peso_bruto:.2,alturaEmbalagem:3,larguraEmbalagem:4,comprimentoEmbalagem:5,anexos:[{anexo:'https://example.com/real.jpg'},{anexo:'javascript:bad'}],descricao_complementar:'<b>Real</b>',categoria:'Fitness e Pilates'});
 assert.equal(d.weight,.2);assert.equal(d.image,'https://example.com/real.jpg');assert.equal(d.description,'Real');assert.equal(d.category,'Fitness & Pilates');
 assert.equal(detailProduct({}).weight,null);assert.equal(detailProduct({}).image,'/imgs/sem-imagem.svg');
});
test('complete pagination is required before authoritative writes',async()=>{
 await assert.rejects(readCatalog({productsPage:async page=>page===1?{pages:2,products:[{id:1}]}:Promise.reject(new Error('offline'))}));
 await assert.rejects(readCatalog({productsPage:async()=>({pages:2,products:[{id:1}]})}));
});
test('authoritative import deactivates old fictitious products, upserts real Tiny catalog and removes missing ones',async()=>{
 const calls=[];const tx={product:{findFirst:async()=>null,updateMany:async q=>calls.push(q),upsert:async q=>calls.push(q)}};
 const count=await applyCatalog(tx,[{id:'123',nome:'Real',preco:10,situacao:'A'}]);assert.equal(count,1);
 assert.equal(calls[0].data.active,false);assert.equal(calls[1].create.stock,0);assert.equal(calls[1].where.tinyId,'123');assert.deepEqual(calls[2].where.tinyId.notIn,['123']);
 await assert.rejects(applyCatalog(tx,[]));
 await assert.rejects(applyCatalog({product:{findFirst:async()=>({id:'reserved'})}},[{id:1}]));
});
test('cart stock refresh preserves prior data on API failure and never invents saldo',async()=>{
 let writes=0;const db={product:{findMany:async()=>[{id:'p',tinyId:'123'}],update:async()=>writes++},$transaction:async fn=>fn({$queryRawUnsafe:async()=>[{locked:true}]})};
 await assert.rejects(refreshCartStock(db,[{id:'p'}],{client:{productDetail:async()=>{throw new Error('offline');},stock:async()=>100}}));assert.equal(writes,0);
});
