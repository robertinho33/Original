'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../../../js/marketing/flash-policy');
const flash=require('./flash-offer');
const campaign=()=>({offerId:'12345678-1234-4234-8234-123456789abc',flashSku:'FLASH',status:'active',discountPercent:30,endsAt:new Date(Date.now()+600000).toISOString()});
const coupon={id:'coupon',code:'PARCEIRO',influencerId:'partner',commission:12,discountType:'percentage',discount:10};
const item={sku:'FLASH',unitPrice:100,quantity:1};
function order(id='first'){const c=campaign();return {orderNumber:id,items:[item],customer:{email:'cliente@example.test',phone:'(11) 98888-7777'},coupon:{...coupon},flashOffer:{id:c.offerId,sku:c.flashSku},totals:{subtotal:100,discount:30,promotionDiscount:30,couponDiscount:0,total:70},payment:{status:'pending'}};}
function fixture(){
 const records=new Map([['settings/storefrontHero',campaign()]]);let queue=Promise.resolve();
 const db={collection:name=>({doc:id=>({id,path:name+'/'+id})})};
 async function transaction(action){const prev=queue;let release;queue=new Promise(r=>release=r);await prev;try{let writing=false;const writes=[];const result=await action({get:async ref=>{assert.equal(writing,false,'Firestore must read before writing');const value=records.get(ref.path);return {exists:value!==undefined,data:()=>structuredClone(value)};},set:(ref,value)=>{writing=true;writes.push(()=>records.set(ref.path,structuredClone(value)));}});writes.forEach(f=>f());return result;}finally{release();}}
 async function create(value,id){return transaction(async tx=>{const ref=db.collection('orders').doc(id),save=await flash.prepareClaim(tx,db,value,ref);save();tx.set(ref,value);});}
 return {records,db,transaction,create};
}
test('flash price accepts coupon attribution without stacking and discounts only regular lines',()=>{
 const c=campaign();assert.deepEqual(policy.calculate([item],coupon,c),{promotionDiscount:30,couponDiscount:0,discount:30,promotionalQuantity:1});
 assert.deepEqual(policy.calculate([item,{sku:'REGULAR',unitPrice:50,quantity:2}],coupon,c),{promotionDiscount:30,couponDiscount:10,discount:40,promotionalQuantity:1});
 assert.equal(policy.calculate([item],{...coupon,discountType:'fixed',discount:999},c).discount,30);
 assert.equal(policy.calculate([item,{sku:'REGULAR',unitPrice:50,quantity:1}],{...coupon,discountType:'fixed',discount:999},c).discount,80);
 assert.equal(policy.calculate([item],coupon,{...c,endsAt:'2020-01-01'}).discount,10);
 assert.equal(policy.calculate([item],coupon,{...c,startsAt:new Date(Date.now()+60000).toISOString()}).promotionDiscount,0);
 assert.equal(policy.calculate([item,item],coupon,c).promotionalQuantity,2);
});
test('order builder ignores forged totals and preserves the partner coupon on the paid amount',async()=>{
 const c=campaign();const sandbox={module:{exports:{}},require:name=>{
 if(name.includes('customer-shipping'))return {prepareCustomerAndShipping:({customer})=>({customer,shipping:{method:'pickup',cost:0}})};
 if(name==='./order-authority')return {prepareOrder:async({items,customer})=>({items:items.map(i=>({...i,unitPrice:100})),customer,totals:{subtotal:items.reduce((s,i)=>s+i.quantity*100,0)}})};
 if(name.includes('coupon-service'))return {validateCoupon:async()=>({valid:true,coupon:{...coupon}})};
 if(name==='./flash-offer')return {apply:async(o,cp)=>{const pricing=policy.calculate(o.items,cp,c);if(pricing.promotionalQuantity>1)throw Error('apenas uma unidade');o.flashOffer={id:c.offerId};Object.assign(o.totals,{promotionDiscount:pricing.promotionDiscount,couponDiscount:pricing.couponDiscount});return pricing.discount;}};
 if(name.includes('app-error'))return require('../../core/app-error');throw Error(name);
 }};vm.runInNewContext(fs.readFileSync(__dirname+'/complete-order-builder.js','utf8'),sandbox);
 const build=sandbox.module.exports.buildCompleteOrder,payload={items:[{sku:'FLASH',quantity:1,unitPrice:0.01}],customer:order().customer,coupon:{code:coupon.code,discount:99},discount:999,flashOfferId:c.offerId};
 const saved=await build(payload);assert.equal(saved.totals.total,70);assert.equal(saved.coupon.influencerId,'partner');assert.equal(saved.coupon.commission,12);assert.equal(saved.totals.couponDiscount,0);
 await assert.rejects(()=>build({...payload,items:[{...item,quantity:2}]}),/apenas uma unidade/);
 await assert.rejects(()=>build({...payload,flashOfferId:'different'}),/mudou ou terminou/);
});
test('one flash unit per customer survives concurrent requests and normalizes email and phone',async()=>{
 const f=fixture();const outcomes=await Promise.allSettled([f.create(order('first'),'first'),f.create(order('second'),'second')]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/já possui/);
 assert.equal([...f.records.keys()].filter(k=>k.startsWith('orders/')).length,1);
 const phoneMatch=order('third');phoneMatch.customer={email:'other@example.test',phone:'+55 11 988887777'};await assert.rejects(()=>f.create(phoneMatch,'third'),/já possui/);
 const emailMatch=order('fourth');emailMatch.customer={email:' CLIENTE@EXAMPLE.TEST ',phone:'11999998888'};await assert.rejects(()=>f.create(emailMatch,'fourth'),/já possui/);
 assert.ok([...f.records.keys()].filter(k=>k.startsWith('flashOfferClaims/')).every(k=>!k.includes('cliente')));
});
test('pending and paid claims remain blocked; confirmed cancellation releases eligibility',async()=>{
 const f=fixture();await f.create(order(),'first');f.records.get('orders/first').payment.status='paid';await assert.rejects(()=>f.create(order('next'),'next'),/já possui/);
 f.records.get('orders/first').payment={status:'pending',expiresAt:'2020-01-01'};await assert.rejects(()=>f.create(order('next'),'next'),/já possui/);
 f.records.get('orders/first').payment={status:'cancelled'};await f.create(order('next'),'next');assert.ok(f.records.has('orders/next'));
});
test('expired or changed campaign and duplicate lines are rejected before a claim is written',async()=>{
 const f=fixture();f.records.get('settings/storefrontHero').endsAt='2020-01-01';await assert.rejects(()=>f.create(order(),'first'),/alterada ou terminou/);assert.equal(f.records.size,1);
 f.records.set('settings/storefrontHero',campaign());const duplicate=order();duplicate.items=[item,item];await assert.rejects(()=>f.create(duplicate,'first'),/alterada ou terminou/);
 const altered=order();altered.totals.promotionDiscount=90;await assert.rejects(()=>f.create(altered,'first'),/alterada ou terminou/);
});

test('flash commission stays with the saved coupon owner at the saved rate on net merchandise',async()=>{
 const records={influencers:[{id:'partner',name:'Parceiro'},{id:'new-owner',name:'Outro'}],coupons:[{id:'coupon',code:'PARCEIRO',influencerId:'new-owner',commission:50}],orders:[{id:'order-id',...order(),createdAt:new Date().toISOString(),payment:{status:'paid'}}],influencerContracts:[]};
 const db={collection:name=>({get:async()=>({docs:(records[name]||[]).map(value=>({id:value.id,data:()=>value}))})})};
 const sandbox={module:{exports:{}},require:()=>({getFirestore:()=>db})};vm.runInNewContext(fs.readFileSync(__dirname+'/../admin/services/partnership-service.js','utf8'),sandbox);
 const overview=await sandbox.module.exports.getOverview(),attributed=overview.attributedOrders[0];assert.equal(attributed.influencerId,'partner');assert.equal(attributed.commissionRate,12);assert.equal(attributed.commissionBase,70);assert.equal(attributed.commissionAmount,8.4);
 records.orders[0].coupon=null;assert.equal((await sandbox.module.exports.getOverview()).unlinkedPaidOrders.length,0);
});
