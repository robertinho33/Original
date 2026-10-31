'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {definitions,buildCombos,registerProfessionalCombos}=require('./professional-combos');
const prices={'3SSKRFEP5':120,'63KEV2FBA':120,'WBZA7Q6LP':150,'YDMYK3MK4':109,'HR6LKXYGJ':80,'EJL97KLUE':69,'NJTFJ9RNF':94.99,'CSH5ETU2N':50,'VEHZKS3RJ':84.9,'P7VJ56493':12.98,'ZR936JBFC':28,'WXM657UMY':28,'V4M66277J':36,'ASUE5CZGP':28,'XFGMQY4RW':28,'TJFJENBKK':36,'ZKDQ2Y47Q':45.9,'RAEKECC87':28,'HCNTRBT4Z':80};
Object.assign(prices,{'3SSKRFEP5':269,'PML3C9J4M':120,'LPGSTQBW8':137.9,'YYYS5P629':133,'P3SMM9FXM':36,'FMC93GCXT':22});
const products=Object.entries(prices).map(([sku,price])=>({sku,name:sku,price,stock:10,active:true,image:'https://example.com/p.png',privateCost:1}));
test('six fixed assortments put EcoBelle first and reconcile per-unit 30% with current prices',()=>{
 const combos=buildCombos(products);assert.equal(combos.length,6);assert.deepEqual(combos.map(x=>x.brand),['EcoBelle','EcoBelle','EcoBelle','Bela Pro','Bela Pro','Bela Pro']);
 assert.deepEqual(combos.map(x=>x.totalCents),[100380,80150,50190,100415,79912,50099]);
 for(const c of combos){assert.equal(c.available,true);assert.equal(c.discountPercent,30);assert.equal(c.totalCents,c.items.reduce((sum,p)=>sum+Math.round(p.unitCents*.70)*p.quantity,0));assert.ok(/^Kit /.test(c.items[0].name)||c.items[0].sku==='3SSKRFEP5'||c.items[0].sku==='LPGSTQBW8');assert.equal(c.totalCents+c.discountCents,c.subtotalCents);assert.ok(Math.abs(c.totalCents-c.target*100)<500);assert.equal(new Set(c.items.map(p=>p.sku)).size,c.items.length);}
 const updated=buildCombos(products.map(p=>p.sku==='3SSKRFEP5'?{...p,price:279}:p));assert.equal(updated[0].subtotalCents,combos[0].subtotalCents+2000);
});
test('missing, inactive, invalid prices and insufficient stock disable the entire combo',()=>{
 for(const patch of [null,{active:false},{price:0},{price:'bad'},{stock:1}]){
 const fixture=products.flatMap(p=>p.sku==='3SSKRFEP5'?(patch?[{...p,...patch}]:[]):[p]);assert.equal(buildCombos(fixture)[0].available,false);
 }
});
test('discount rounds each unit before multiplying quantities, matching the displayed list',()=>{
 const c=buildCombos(products.map(p=>p.sku==='3SSKRFEP5'?{...p,price:1.99}:p))[0];
 assert.equal(c.items[0].discountedUnitCents,139);
 assert.equal(c.totalCents,c.items.reduce((sum,p)=>sum+p.discountedUnitCents*p.quantity,0));
 assert.equal(c.items[0].discountedUnitCents*c.items[0].quantity,278);
});
test('public offers expose only product fields and handle catalog failure',async t=>{
 const app=express();registerProfessionalCombos(app,{getProducts:async()=>products});const server=app.listen(0);await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const r=await fetch('http://localhost:'+server.address().port+'/api/professional-combos');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const body=await r.text();assert.ok(!body.includes('privateCost'));assert.equal(JSON.parse(body).combos.length,definitions.length);
});
