const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTinyOrder, remoteMatches, processOne, exportPaidOrders, acknowledgeTinyStock } = require('../lib/tiny-orders.cjs');
const { createTinyClient, syncMappedTiny, reconcileAcknowledgedStock, syncTiny, persistentRateLimit } = require('../lib/tiny-sync.cjs');
const { initialProduct } = require('../scripts/seed.js');

function order(overrides = {}) {
 return { id:'o1',orderNumber:'CNL-12345678-1234-1234-1234-123456789012',paymentStatus:'PAID',paymentReview:false,stockReleased:false,
  tinyExportStatus:'PENDING',tinyExportAttemptedAt:null,tinyOrderId:null,createdAt:new Date('2026-10-30T15:00:00Z'),
  customerName:'Cliente de Teste',customerCpf:'12345678901',customerPhone:'11999999999',customerEmail:'teste@example.com',
  shippingStreet:'Rua Teste',shippingNum:'10',shippingComp:'',shippingDist:'Centro',shippingCep:'01001000',shippingCity:'São Paulo',shippingState:'SP',
  total:110,shippingCost:20,discount:10,items:[{productId:'p1',tinyId:'987',sku:'SKU1',name:'Produto',price:100,quantity:1}],...overrides };
}
function exportDb(value=order()) {
 const updates=[];
 const db = {updates,order:{
  update:async q=>{updates.push(q);Object.assign(value,q.data);return value;},
  updateMany:async q=>{if(value.tinyExportAttemptedAt) return {count:0};Object.assign(value,q.data);updates.push(q);return {count:1};},
  findUnique:async()=>value,
  findMany:async()=>[value],
 }};
 db.$transaction=async fn=>fn({...db,$queryRawUnsafe:async()=>[{locked:true}]});
 return db;
}
function remote(local=order()) {return {id:'999',numero_ecommerce:local.orderNumber,total_pedido:local.total,cliente:{cpf_cnpj:local.customerCpf},itens:[{item:{id_produto:'987',quantidade:'1'}}]};}

test('Tiny payload exports only paid orders and immutable mapped item IDs',()=>{
 const payload=buildTinyOrder(order());assert.equal(payload.pedido.numero_pedido_ecommerce,order().orderNumber);
 assert.equal(payload.pedido.itens[0].item.id_produto,'987');assert.equal(payload.pedido.valor_desconto,10);
 assert.equal(payload.pedido.situacao,'aprovado');assert.equal(payload.pedido.cliente.atualizar_cliente,'N');
 for(const override of [{paymentStatus:'PENDING'},{paymentReview:true},{stockReleased:true},{total:1},{items:[{tinyId:null,price:100,quantity:1}]}]) assert.throws(()=>buildTinyOrder(order(override)));
});

test('Tiny recovery requires exact reference, total, customer and item quantities',()=>{
 assert.equal(remoteMatches(order(),remote()),true);
 for(const bad of [{...remote(),numero_ecommerce:'another'},{...remote(),total_pedido:1},{...remote(),cliente:{cpf_cnpj:'00000000000'}},{...remote(),itens:[{item:{id_produto:'987',quantidade:'2'}}]}]) assert.equal(remoteMatches(order(),bad),false);
});

test('Tiny sends at most one creation POST after the durable attempt',async()=>{
 const value=order(),db=exportDb(value);let posts=0;
 const api={findOrdersByReference:async()=>[],createOrder:async()=>{assert.ok(value.tinyExportAttemptedAt);assert.equal(value.tinyExportStatus,'SENDING');posts++;return {id:'999'};}};
 assert.equal(await processOne(db,api,value),'SENT');assert.equal(posts,1);assert.equal(value.tinyOrderId,'999');assert.equal(value.stockReleased,false);
 assert.equal(await processOne(db,api,value),'SENT');assert.equal(posts,1);
});

test('Tiny ambiguous write is REVIEW and never repeats creation',async()=>{
 const value=order(),db=exportDb(value);let posts=0;
 const api={findOrdersByReference:async()=>[],createOrder:async()=>{posts++;throw new Error('timeout');}};
 assert.equal(await processOne(db,api,value),'REVIEW');assert.ok(value.tinyExportAttemptedAt);
 assert.equal(await processOne(db,api,value),'REVIEW');assert.equal(posts,1);
});

test('Tiny unknown previous attempt can recover by matching remote reference',async()=>{
 const value=order({tinyExportAttemptedAt:new Date(),tinyExportStatus:'REVIEW'}),db=exportDb(value);let posts=0;
 const api={findOrdersByReference:async()=>[{id:'999'}],orderDetail:async()=>remote(value),createOrder:async()=>{posts++;}};
 assert.equal(await processOne(db,api,value),'RECOVERED');assert.equal(value.tinyOrderId,'999');assert.equal(posts,0);
});

test('Tiny mismatched or duplicated recovery refuses to create',async()=>{
 for(const found of [[{id:'999'}],[{id:'999'},{id:'1000'}]]) {
  const value=order(),db=exportDb(value);let posts=0;
  const api={findOrdersByReference:async()=>found,orderDetail:async()=>({...remote(value),total_pedido:1}),createOrder:async()=>{posts++;}};
  assert.equal(await processOne(db,api,value),'REVIEW');assert.equal(posts,0);
 }
});

test('Tiny disabled export and busy lock do no provider calls',async()=>{
 let calls=0;const client={findOrdersByReference:async()=>{calls++;}};
 assert.equal((await exportPaidOrders({}, {enabled:false,client})).enabled,false);
 const db={$transaction:async fn=>fn({$queryRawUnsafe:async()=>[{locked:false}]})};
 assert.equal((await exportPaidOrders(db,{enabled:true,client})).busy,true);assert.equal(calls,0);
});

test('Tiny lookup failure never authorizes a POST',async()=>{
 const db=exportDb();let posts=0;
 const client={findOrdersByReference:async()=>{throw new Error('unavailable');},createOrder:async()=>{posts++;}};
 const result=await exportPaidOrders(db,{enabled:true,client});assert.equal(result.failedReads,1);assert.equal(posts,0);assert.equal(db.updates.length,0);
});

test('Tiny acknowledgement requires paid exported order and records evidence once',async()=>{
 const value=order({tinyExportStatus:'SENT',tinyOrderId:'999'}),db=exportDb(value);
 assert.equal((await acknowledgeTinyStock(db,'o1','NF 123 baixa confirmada')).alreadyAcknowledged,false);assert.equal(value.tinyStockAcknowledgement,'NF 123 baixa confirmada');
 assert.equal((await acknowledgeTinyStock(db,'o1','outra referência')).alreadyAcknowledged,true);assert.equal(value.stockReleased,false);
 for(const override of [{paymentStatus:'REFUNDED'},{paymentReview:true},{tinyExportStatus:'SENDING'},{tinyOrderId:null},{stockReleased:true}]) await assert.rejects(acknowledgeTinyStock(exportDb(order(override)),'o1','NF 123'));
});

test('Tiny confirmed stock import releases aggregate reservations atomically only for included products',async()=>{
 const changes=[];
 const tx={order:{findMany:async()=>[order()],update:async q=>changes.push(q)},product:{findUnique:async()=>({tinyId:'987',reservedStock:3}),update:async q=>changes.push(q)}};
 assert.equal(await reconcileAcknowledgedStock(tx,new Date(),new Set()),0);assert.equal(changes.length,0);
 assert.equal(await reconcileAcknowledgedStock(tx,new Date(),new Set(['p1'])),1);
 assert.equal(changes[0].data.reservedStock.decrement,1);assert.equal(changes[1].data.stockReleased,true);
});

test('Tiny reconciliation rejects insufficient or changed reservations',async()=>{
 for(const product of [{tinyId:'987',reservedStock:0},{tinyId:'other',reservedStock:10}]) {
  let changes=0;const tx={order:{findMany:async()=>[order()],update:async()=>changes++},product:{findUnique:async()=>product,update:async()=>changes++}};
  await assert.rejects(reconcileAcknowledgedStock(tx,new Date(),new Set(['p1'])));assert.equal(changes,0);
 }
});

test('Tiny search uses reference in POST body, accepts no-records code and rejects ignored filter',async()=>{
 let requested;const client=createTinyClient('secret',{wait:async()=>{},intervalMs:0,fetchImpl:async(url,init)=>{requested={url,init};return {ok:true,json:async()=>({retorno:{status:'Erro',codigo_erro:20}})};}});
 assert.deepEqual(await client.findOrdersByReference('CNL-1'),[]);assert.equal(requested.url.includes('secret'),false);assert.equal(requested.init.body.get('numeroEcommerce'),'CNL-1');
 const ignored=createTinyClient('secret',{intervalMs:0,fetchImpl:async()=>({ok:true,json:async()=>({retorno:{status:'OK',pedidos:[{pedido:{id:'1',numero_ecommerce:'other'}}]}})})});
 await assert.rejects(ignored.findOrdersByReference('CNL-1'));
});

test('Tiny client recognizes object and array create responses and rejects unconfirmed registration',async()=>{
 for(const registros of [{registro:{status:'OK',id:'1'}},[{registro:{status:'OK',id:'1'}}]]) {
  const api=createTinyClient('secret',{fetchImpl:async()=>({ok:true,json:async()=>({retorno:{status:'OK',registros}})})});
  assert.equal((await api.createOrder({pedido:{}})).id,'1');
 }
 const api=createTinyClient('secret',{fetchImpl:async()=>({ok:true,json:async()=>({retorno:{status:'OK',registros:{registro:{status:'Erro'}}}})})});
 await assert.rejects(api.createOrder({pedido:{}}));
});

test('Tiny sync scans all pages before rejecting duplicate SKUs; explicit IDs remain valid',async()=>{
 for(const explicit of [false,true]) {
  const updated=[];let calls=0;
  const tx={$queryRawUnsafe:async()=>[{locked:true}],product:{findMany:async()=>[{id:'p1',sku:'DUP',tinyId:explicit?'10':null}],update:async q=>updated.push(q),findUnique:async()=>({})},order:{findMany:async()=>[]},syncLog:{create:async()=>{}}};
  const db={$transaction:async fn=>fn(tx),syncLog:{create:async()=>{}}};
  const client={productsPage:async page=>({pages:2,products:[{id:page===1?'10':'11',codigo:'DUP',preco:100,situacao:'A'}]}),stock:async()=>{calls++;return 4;}};
  const result=await syncMappedTiny(db,{client});assert.equal(result.success,explicit);assert.equal(calls,explicit?1:0);assert.equal(updated.length,explicit?1:0);
 }
});

test('Tiny persistent request budget survives failed application transactions',async()=>{
 let at=1000,current=1000,waited=0;
 const db={setting:{findUnique:async()=>({value:String(at)}),upsert:async q=>{at=Number(q.update.value);}}};
 const gate=persistentRateLimit(db,{now:()=>current,wait:async ms=>{waited+=ms;current+=ms;}});
 await gate();assert.equal(waited,2100);assert.equal(at,3100);
});

test('seed uses only confirmed mappings and real positive shipping measurements',()=>{
 const product={slug:'produto',name:'Produto',price:100,id:1,tinyId:'fake',sku:'fake'};
 assert.equal(initialProduct(product).tinyId,null);assert.equal(initialProduct(product).stock,0);
 assert.equal(initialProduct(product,{tinyId:'987',sku:'SKU1',confirmed:false,weight:1}).tinyId,null);
 const mapped=initialProduct(product,{tinyId:'987',sku:'SKU1',confirmed:true,weight:1,width:20,height:10,length:30});
 assert.equal(mapped.tinyId,'987');assert.equal(mapped.sku,'SKU1');assert.equal(mapped.weight,1);assert.equal(mapped.stock,0);
});
