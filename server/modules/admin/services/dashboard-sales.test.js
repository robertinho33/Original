'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),sales=require('./dashboard-sales');
const timestamp=value=>({toDate:()=>new Date(value)});
function collection(rows){
  const queries=[];
  function ref(filters=[]){return {where:(field,op,value)=>ref([...filters,{field,op,value}]),select(){return this;},async get(){queries.push(filters);const fieldValue=(row,field)=>field.split('.').reduce((v,k)=>v?.[k],row);
    const docs=rows.filter(row=>filters.every(({field,op,value})=>{const raw=fieldValue(row,field);if(op==='in')return value.includes(raw);const temporal=value instanceof Date;if(temporal!==!!(raw instanceof Date||raw?.toDate))return false;const actual=temporal?sales.dateValue(raw):raw;return op==='>='?actual>=value:actual<value;})).map(row=>({id:row.id,data:()=>row}));return {docs};}};}
  return {ref:ref(),queries};
}
test('business-day bounds use São Paulo rather than server UTC and cover exactly the requested days',()=>{
  assert.equal(sales.day('2026-10-22T02:59:59Z'),'2026-10-21');
  const bounds=sales.range(1,new Date('2026-10-22T14:00:00Z'));
  assert.equal(bounds.start.toISOString(),'2026-10-22T03:00:00.000Z');assert.equal(bounds.end.toISOString(),'2026-10-23T03:00:00.000Z');
  assert.equal(sales.range(30,new Date('2026-10-22T14:00:00Z')).start.toISOString(),'2026-09-23T03:00:00.000Z');
  assert.equal(sales.day(timestamp('2026-10-22T14:00:00Z')),'2026-10-22');assert.equal(sales.dateValue('invalid'),null);
});
test('Firestore queries accept ISO strings and timestamps, then reject neighboring days including offsets',async()=>{
  const bounds=sales.range(1,new Date('2026-10-22T14:00:00Z'));
  const data=collection([{id:'string',createdAt:'2026-10-22T14:19:54.426Z'},{id:'stamp',createdAt:timestamp('2026-10-22T20:00:00Z')},{id:'offset',createdAt:'2026-10-22T00:30:00-03:00'},{id:'before',createdAt:'2026-10-22T02:59:59Z'},{id:'after',createdAt:'2026-10-23T03:00:00Z'},{id:'invalid',createdAt:'not-a-date'}]);
  const result=await sales.ordersBetween(data.ref,bounds);assert.deepEqual(result.map(o=>o.id).sort(),['offset','stamp','string']);assert.equal(data.queries.length,2);
  assert.ok(data.queries.some(filters=>filters[0].value instanceof Date));assert.ok(data.queries.some(filters=>typeof filters[0].value==='string'));
});
test('revenue and daily sales include only confirmed payments and use canonical totals without floating-point drift',()=>{
  const bounds=sales.range(1,new Date('2026-10-22T14:00:00Z')),date='2026-10-22T14:00:00Z';
  const rows=[{createdAt:date,payment:{status:'paid'},totals:{total:27.96}},{createdAt:date,paymentStatus:'approved',total:0.1},{createdAt:date,paymentStatus:'paid',total:0.2},{createdAt:date,payment:{status:'pending'},paymentStatus:'paid',total:500},{createdAt:date,paymentStatus:'failed',total:100},{createdAt:date,paymentStatus:'refunded',total:100}];
  assert.equal(sales.revenue(rows),28.26);assert.deepEqual(sales.timeline(rows,bounds),[{date:'2026-10-22',orders:3,revenue:28.26}]);
  assert.equal(sales.orderTotal({totals:{total:0},total:100}),0);assert.equal(sales.orderTotal({total:-5}),0);assert.equal(sales.orderTotal({total:'bad'}),0);
});
test('pending shipments count paid orders once and exclude delivered or cancelled orders',async()=>{
  const rows=[{id:'pending',payment:{status:'paid'},paymentStatus:'paid',logistics:{status:'pending'}},{id:'legacy',paymentStatus:'approved',logisticsStatus:'processing'},{id:'delivered',payment:{status:'paid'},status:'pending',logistics:{status:'delivered'}},{id:'unpaid',payment:{status:'pending'},logistics:{status:'pending'}},{id:'cancelled',payment:{status:'paid'},status:'cancelled',logistics:{status:'pending'}},{id:'unknown',payment:{status:'paid'}}];
  const paid=await sales.readPaidOrders(collection(rows).ref);assert.equal(paid.length,5);assert.equal(sales.pendingShipments(paid),2);
});
