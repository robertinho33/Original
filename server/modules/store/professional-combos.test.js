'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {definitions,buildCombos,registerProfessionalCombos}=require('./professional-combos');
const prices={'75DJZXWT5':120,'63KEV2FBA':120,'WBZA7Q6LP':150,'YDMYK3MK4':109,'HR6LKXYGJ':80,'EJL97KLUE':69,'NJTFJ9RNF':94.99,'CSH5ETU2N':50,'VEHZKS3RJ':84.9,'P7VJ56493':12.98,'ZR936JBFC':28,'WXM657UMY':28,'V4M66277J':36,'ASUE5CZGP':28,'XFGMQY4RW':28,'TJFJENBKK':36,'ZKDQ2Y47Q':45.9,'RAEKECC87':28,'HCNTRBT4Z':80};
const products=Object.entries(prices).map(([sku,price])=>({sku,name:sku,price,stock:10,active:true,image:'https://example.com/p.png',privateCost:1}));
test('six fixed assortments put EcoBelle first and reconcile 25% with current prices',()=>{
 const combos=buildCombos(products);assert.equal(combos.length,6);assert.deepEqual(combos.map(x=>x.brand),['EcoBelle','EcoBelle','EcoBelle','Bela Pro','Bela Pro','Bela Pro']);
 assert.deepEqual(combos.map(x=>x.totalCents),[99899,80092,49574,100013,79928,49800]);
 for(const c of combos){assert.equal(c.available,true);assert.equal(c.totalCents,Math.round(c.subtotalCents*.75));assert.equal(c.totalCents+c.discountCents,c.subtotalCents);assert.ok(Math.abs(c.totalCents-c.target*100)<500);assert.equal(new Set(c.items.map(p=>p.sku)).size,c.items.length);}
 const updated=buildCombos(products.map(p=>p.sku==='75DJZXWT5'?{...p,price:130}:p));assert.equal(updated[0].subtotalCents,combos[0].subtotalCents+2000);
});
test('missing, inactive, invalid prices and insufficient stock disable the entire combo',()=>{
 for(const patch of [null,{active:false},{price:0},{price:'bad'},{stock:1}]){
 const fixture=products.flatMap(p=>p.sku==='75DJZXWT5'?(patch?[{...p,...patch}]:[]):[p]);assert.equal(buildCombos(fixture)[0].available,false);
 }
});
test('public offers expose only product fields and handle catalog failure',async t=>{
 const app=express();registerProfessionalCombos(app,{getProducts:async()=>products});const server=app.listen(0);await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const r=await fetch('http://localhost:'+server.address().port+'/api/professional-combos');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const body=await r.text();assert.ok(!body.includes('privateCost'));assert.equal(JSON.parse(body).combos.length,definitions.length);
});
