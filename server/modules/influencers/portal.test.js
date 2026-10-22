'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const express = require('express');
const credentials = require('./credentials');
const { createRouter, createAccessHandler, projectDashboard } = require('./portal');
function database() {
  const records = new Map();
  const ref = key => ({ id: key.split('/').pop(), key,
    get: async () => ({ id: key.split('/').pop(), exists: records.has(key), data: () => structuredClone(records.get(key)) }),
    set: async (value, options) => set({ key }, value, options),
    update: async value => update({ key }, value), delete: async () => records.delete(key) });
  function set(target, data, options = {}) { records.set(target.key, { ...(options.merge ? records.get(target.key) : {}), ...structuredClone(data) }); }
  function update(target, data) { assert.ok(records.has(target.key)); set(target, data, { merge: true }); }
  const db = { collection: name => ({ doc: id => ref(name + '/' + id), get:async()=>({docs:[...records].filter(([key])=>key.startsWith(name+'/')).map(([key])=>({id:key.split('/').pop(),data:()=>structuredClone(records.get(key))}))}), where: (field, op, value) => ({
    get: async () => ({ docs: [...records].filter(([key, row]) => key.startsWith(name + '/') && row[field] === value).map(([key]) => ({ data: () => structuredClone(records.get(key)) })) }) }) }),
    runTransaction: async fn => fn({ get: target => target.get(), set, update, delete: target => records.delete(target.key) }) };
  return { db, records };
}
test('password policy, salted hashes and constant-time verification never store clear passwords', async () => {
  assert.equal(credentials.passwordValid('OnlyLetters'), false); assert.equal(credentials.passwordValid('1234567890'), false);
  assert.equal(credentials.passwordValid('Short1'), false); assert.equal(credentials.passwordValid('StrongPass12'), true);
  const first = await credentials.passwordRecord('StrongPass12'), second = await credentials.passwordRecord('StrongPass12');
  assert.notEqual(first.passwordHash, second.passwordHash); assert.ok(!JSON.stringify(first).includes('StrongPass12'));
  assert.equal(await credentials.passwordMatches('StrongPass12', first), true); assert.equal(await credentials.passwordMatches('WrongPass12', first), false);
  assert.equal(await credentials.passwordMatches('StrongPass12', null), false);
});

test('portal store edits use session ownership, preserve metadata and reject stale revisions and forged fields',async()=>{
  const {db,records}=database(),token='a'.repeat(64);
  records.set('influencers/one',{name:'Um',active:true,portalEnabled:true,email:'one@example.test',phone:'11999999999'});
  records.set('influencerPortalAccess/one',{enabled:true,version:'version',email:'one@example.test',phone:'11999999999'});
  records.set('influencerPortalSessions/'+credentials.hash(token),{influencerId:'one',version:'version',expiresAt:Date.now()+60000});
  const original={enabled:true,name:'Vitrine Um',coupon:'CELLO',skus:['A'],selectionRevision:'v1',image:'https://example.com/photo.jpg',privateField:'PRIVATE'};
  records.set('influencerPublicStores/one',original);records.set('influencerPublicStores/two',{...original,name:'PRIVATE-OTHER-STORE'});
  records.set('coupons/cello',{code:'CELLO',influencerId:'one',active:true});
  const app=express();app.use(express.json());app.use(createRouter({getDb:()=>db,getStoreCatalog:async()=>[{sku:'A',name:'A',price:10},{sku:'B',name:'B',price:20}]}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const url='http://127.0.0.1:'+server.address().port+'/store',headers={'Content-Type':'application/json',Origin:'https://www.fiosperfeitos.com.br',Cookie:credentials.cookieName+'='+token};
  async function call(method,body,extra={}){return fetch(url,{method,headers:{...headers,...extra},body:JSON.stringify(body)});}
  try{
    assert.equal((await call('POST',{}, {Cookie:''})).status,401);
    let response=await call('POST',{influencerId:'two'}),result=await response.json();
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(result.data.name,'Vitrine Um');assert.equal(result.data.revision,'v1');
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(result).includes('password'));
    assert.equal((await call('PUT',{skus:['B'],revision:'v1'},{Origin:'https://evil.test'})).status,403);
    for(const body of [{skus:['B'],revision:'v1',influencerId:'two'},{skus:['B'],revision:'v1',enabled:true},{skus:['B'],revision:'v1',coupon:'OTHER'},{skus:['A','a'],revision:'v1'},{skus:[],revision:'v1'},{skus:['A','B','C','D','E','F','G'],revision:'v1'},{skus:['HIDDEN'],revision:'v1'},{skus:['B']}])assert.equal((await call('PUT',body)).status,400);
    response=await call('PUT',{skus:['B'],revision:'v1'});result=await response.json();assert.equal(response.status,200);
    const saved=records.get('influencerPublicStores/one');assert.deepEqual(saved.skus,['B']);assert.equal(saved.name,original.name);assert.equal(saved.coupon,original.coupon);assert.equal(saved.enabled,true);assert.equal(saved.image,original.image);assert.equal(saved.privateField,'PRIVATE');
    assert.deepEqual(records.get('influencerPublicStores/two').skus,['A']);assert.notEqual(result.data.revision,'v1');
    assert.equal((await call('PUT',{skus:['A'],revision:'v1'})).status,409);assert.deepEqual(records.get('influencerPublicStores/one').skus,['B']);
    records.get('influencerPublicStores/one').enabled=false;
    response=await call('POST',{});result=await response.json();assert.equal(result.data.published,false);assert.equal(result.data.storeUrl,'');
    assert.equal((await call('PUT',{skus:['A'],revision:saved.selectionRevision})).status,200);assert.equal(records.get('influencerPublicStores/one').enabled,false);
    records.get('influencerPortalSessions/'+credentials.hash(token)).expiresAt=0;
    assert.equal((await call('PUT',{skus:['A'],revision:'any'})).status,401);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('projection filters owner and date and separates estimated, pending and paid commissions without customer data', () => {
  const row = { influencerId:'one',orderDocumentId:'o1',orderId:'ORDER-1',createdAt:'2026-10-19',paymentStatus:'Pago',orderTotal:100,commissionAmount:10,commissionRate:10,customer:{name:'PRIVATE'},publicTrackingToken:'SECRET' };
  const overview = { attributedOrders:[row,{...row,influencerId:'two',orderId:'OTHER-ORDER'}, {...row,orderDocumentId:'o2',orderId:'ORDER-2'}, {...row,orderDocumentId:'o3',orderId:'ORDER-3'}] };
  const data = projectDashboard('one',overview,[{influencerId:'one',orderDocumentId:'o1',amount:10,status:'paid'}, {influencerId:'one',orderDocumentId:'o2',amount:10,status:'pending'}],new Map([['o1',{status:'shipped'}]]),{from:'2026-10-01',to:'2026-10-31'});
  assert.equal(data.orders.length,3); assert.equal(data.summary.revenue,300); assert.equal(data.summary.commissionPaid,10);
  assert.equal(data.summary.commissionPending,10); assert.equal(data.summary.commissionEstimated,10);
  assert.equal(data.orders[0].logisticsStatus,'shipped');
  for(const forbidden of ['OTHER-ORDER','PRIVATE','SECRET','customer','publicTrackingToken'])assert.ok(!JSON.stringify(data).includes(forbidden));
  assert.equal(projectDashboard('one',overview,[],new Map(),{from:'2027-01-01'}).orders.length,0);
  const late = {attributedOrders:[{...row,createdAt:'2026-10-20T01:00:00.000Z'}]};
  assert.equal(projectDashboard('one',late,[],new Map(),{from:'2026-10-19',to:'2026-10-19'}).orders.length,1);
});
test('HTTP access requires email+phone+password, scopes sessions, rejects forged owners and revokes changed credentials', async () => {
  const { db, records } = database();
  records.set('influencers/one',{name:'Pessoa Um',email:'one@example.test',phone:'11999999999',active:true});
  records.set('influencers/two',{name:'Pessoa Dois',email:'two@example.test',phone:'11888888888',active:true});
  const overview = { attributedOrders:[{influencerId:'one',orderDocumentId:'sale1',orderId:'OWN-SALE',createdAt:'2026-10-19',paymentStatus:'Pago',orderTotal:80,commissionAmount:8,products:[{sku:'OWN-SKU',name:'Produto próprio',quantity:2}]}, {influencerId:'two',orderDocumentId:'sale2',orderId:'PRIVATE-OTHER-SALE',createdAt:'2026-10-19',paymentStatus:'Pago',orderTotal:200,products:[{sku:'PRIVATE-OTHER-SKU',name:'Produto de outro influenciador',quantity:99}]}] };
  records.set('orders/sale1',{customer:{name:'PRIVATE-CUSTOMER'},publicTrackingToken:'PRIVATE-TOKEN',logistics:{status:'delivered'}});
  const app=express();app.use(express.json());app.use('/portal',createRouter({getDb:()=>db,getOverview:async()=>overview}));
  app.put('/access/:id',(req,res,next)=>{req.admin={role:req.get('x-role')||'admin',uid:'test-admin'};next();},createAccessHandler({getDb:()=>db}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(path,body={},headers={},method='POST')=>{
    const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
  };
  try {
    assert.equal((await call('/portal/dashboard')).status,401);
    assert.equal((await call('/access/one',{password:'StrongPass12'},{'x-role':'collaborator'},'PUT')).status,403);
    assert.equal((await call('/access/one',{password:'Weak'},{},'PUT')).status,400);
    assert.equal((await call('/access/one',{password:'StrongPass12'},{},'PUT')).status,200);
    assert.equal(records.get('influencers/one').passwordHash,undefined);
    assert.ok(!JSON.stringify(records.get('influencerPortalAccess/one')).includes('StrongPass12'));
    assert.equal((await call('/portal/login',{email:'one@example.test',phone:'11888888888',password:'StrongPass12'})).status,401);
    assert.equal((await call('/portal/login',{email:'one@example.test',phone:'11999999999',password:'WrongPass12'})).status,401);
    const logged=await call('/portal/login',{email:'ONE@example.test',phone:'+55 (11) 99999-9999',password:'StrongPass12'});
    assert.equal(logged.status,200);assert.match(logged.cookie,/HttpOnly/i);assert.match(logged.cookie,/Secure/i);assert.match(logged.cookie,/SameSite=Strict/i);
    const cookie=logged.cookie.split(';')[0];
    const dashboard=await call('/portal/dashboard',{influencerId:'two'},{Cookie:cookie});
    assert.equal(dashboard.data.data.bestSellers[0].sku,'OWN-SKU');assert.equal(dashboard.data.data.bestSellers[0].quantity,2);
    assert.equal(dashboard.status,200);assert.equal(dashboard.data.data.orders[0].orderNumber,'OWN-SALE');
    assert.equal(dashboard.data.data.orders[0].logisticsStatus,'delivered');
    for(const forbidden of ['PRIVATE-OTHER-SALE','PRIVATE-OTHER-SKU','PRIVATE-CUSTOMER','PRIVATE-TOKEN','passwordHash'])assert.ok(!JSON.stringify(dashboard.data).includes(forbidden));
    const session = records.get('influencerPortalSessions/' + credentials.hash(cookie.split('=')[1]));
    const until = session.expiresAt; session.expiresAt = 0;
    assert.equal((await call('/portal/dashboard',{}, {Cookie:cookie})).status,401);
    session.expiresAt = until;
    assert.equal((await call('/access/one',{password:'NewStrong12'},{},'PUT')).status,200);
    assert.equal((await call('/portal/dashboard',{}, {Cookie:cookie})).status,401);
    const second=await call('/portal/login',{email:'one@example.test',phone:'11999999999',password:'NewStrong12'});
    const secondCookie=second.cookie.split(';')[0];
    assert.equal((await call('/access/one',{enabled:false},{},'PUT')).status,200);
    assert.equal((await call('/portal/dashboard',{}, {Cookie:secondCookie})).status,401);
    assert.equal((await call('/portal/logout',{}, {Cookie:secondCookie})).status,200);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
