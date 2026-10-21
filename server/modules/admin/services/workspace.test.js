'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {planAdjustment}=require('./inventory-adjustment');
const model=()=>import('../../../../js/admin/modules/workspace-data.js');
test('catalog search matches accents, multiple words and SKU while accounting for reserved units',async()=>{
  const {catalogRows,filterCatalog}=await model();
  const rows=catalogRows([{id:'one',sku:'ABC',name:'Máscara Capilar',stock:10,sourceName:'Marca A',categoryName:'Tratamento'},{id:'two',sku:'OTHER',name:'Shampoo',stock:0}], [{sku:'ABC',quantity:8,reserved:6}]);
  assert.equal(rows[0]._available,2);assert.equal(rows[0]._physical,8);assert.equal(rows[0]._reserved,6);
  assert.equal(filterCatalog(rows,{query:'mascara marca'}).length,1);assert.equal(filterCatalog(rows,{query:'abc'})[0].id,'one');
  assert.equal(filterCatalog(rows,{stock:'low'}).length,1);assert.equal(filterCatalog(rows,{stock:'empty'})[0].id,'two');
  assert.equal(filterCatalog(rows,{category:'Tratamento'}).length,1);assert.equal(filterCatalog(rows,{query:'inexistente'}).length,0);
});
test('finance and sales ranking count only paid orders and use the same period in Sao Paulo',async()=>{
  const {normalizeOrders,periodRows,summarizeOrders,rankSales}=await model();
  const orders=normalizeOrders([{id:'p1',createdAt:'2026-10-20T01:00:00Z',total:100,payment:{status:'paid'},items:[{sku:'A',quantity:2}]},{id:'p2',createdAt:'2026-10-19',total:50,paymentStatus:'Pendente',items:[{sku:'B',quantity:20}]},{id:'p3',createdAt:'2026-10-19',total:80,paymentStatus:'paid',status:'refunded',items:[{sku:'C',quantity:40}]}]);
  const rows=periodRows(orders,{from:'2026-10-19',to:'2026-10-19'}),summary=summarizeOrders(rows);
  assert.equal(rows.length,3);assert.equal(summary.revenue,100);assert.equal(summary.pendingAmount,50);assert.equal(summary.cancelledAmount,80);assert.equal(summary.paid,1);assert.equal(summary.ticket,100);
  assert.deepEqual(rankSales(rows).map(p=>[p.sku,p.quantity]),[['A',2]]);
  assert.equal(periodRows(orders,{from:'2026-10-20'}).length,0);
});
test('CSV cells quote data and neutralize spreadsheet formula injection',async()=>{
  const {csvCell}=await model();assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('Produto "A"'),'"Produto ""A"""');assert.equal(csvCell(' +cmd'),'"\' +cmd"');
});
test('inventory movements never consume reserved stock or accept fractional quantities',()=>{
  assert.deepEqual(planAdjustment(10,3,-7),{physical:3,reserved:3,available:0});
  assert.deepEqual(planAdjustment(10,3,5),{physical:15,reserved:3,available:12});
  for(const delta of [-8,-11,0,0.5,NaN,Infinity])assert.throws(()=>planAdjustment(10,3,delta));
});


test('admin search accepts legacy SKU names and recovers brand labels provided by source metadata',async()=>{
  const {catalogRows,filterCatalog}=await model();
  const rows=catalogRows([{id:'legacy',SKU:'00000258',Nome:'Máscara reparadora',sourceId:'brae',stock:5},{id:'other',sku:'TR1',name:'Shampoo',brand:'TRUSS',stock:1}],[],[{id:'brae',name:'Braé'}]);
  assert.equal(filterCatalog(rows,{query:'brae mascara'})[0].id,'legacy');assert.equal(filterCatalog(rows,{query:'00000258'})[0].name,'Máscara reparadora');assert.equal(filterCatalog(rows,{brand:'TRUSS'}).length,1);
});
