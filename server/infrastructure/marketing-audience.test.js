'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('customer campaign minimum orders and spend count paid purchases only',async()=>{
 const orders=[{customer:{email:'paid@example.test'},payment:{status:'paid'},totals:{total:120},total:999,createdAt:'2026-10-22'}, {customer:{email:'paid@example.test'},payment:{status:'pending'},totals:{total:400}}, {customer:{email:'pending@example.test'},payment:{status:'pending'},totals:{total:300}}, {customer:{email:'refunded@example.test'},payment:{status:'refunded'},status:'paid',totals:{total:500}}];
 const db={collection:name=>({get:async()=>({docs:(name==='orders'?orders:[]).map((data,index)=>({id:String(index),data:()=>data}))})})};
 const sandbox={module:{exports:{}},require:()=>({getFirestore:()=>db})};vm.runInNewContext(fs.readFileSync(__dirname+'/../modules/admin/services/marketing-service.js','utf8'),sandbox);
 let audience=await sandbox.module.exports.previewAudience('customers',{minOrders:1,minSpend:100});assert.equal(audience.length,1);assert.equal(audience[0].email,'paid@example.test');assert.equal(audience[0].orderCount,1);assert.equal(audience[0].spend,120);
 audience=await sandbox.module.exports.previewAudience('customers',{minOrders:2});assert.equal(audience.length,0);
});
