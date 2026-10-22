const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createRouter,adminHandlers,cookie}=require('./portal'),credentials=require('../influencers/credentials');
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

test('professional applications require approval; temporary credentials force change and never grant administrative scope',async()=>{
 const {db,records}=database(),handlers=adminHandlers({getDb:()=>db});const app=express();app.use(express.json());app.use('/portal',createRouter({getDb:()=>db}));app.use('/admin',(req,res,next)=>{req.admin={role:req.get('test-role'),uid:'test-admin'};next();});app.get('/admin',handlers.list);app.put('/admin/:id',handlers.save);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;const headers={'Content-Type':'application/json',Origin:'https://www.fiosperfeitos.com.br'};
 const call=(url,body={},extra={},method='POST')=>fetch(base+url,{method,headers:{...headers,...extra},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 const input={company:'Salão de teste',name:'Responsável',email:'partner@example.test',phone:'11999999999',city:'São Paulo/SP',type:'salon',consent:true};
 try{
  assert.equal((await call('/portal/apply',{...input,status:'approved'})).status,400);
  assert.equal((await call('/portal/apply',input,{Origin:'https://evil.test'})).status,403);
  assert.equal((await call('/portal/apply',input)).status,202);assert.equal((await call('/portal/apply',input)).status,202);
  assert.equal([...records.keys()].filter(k=>k.startsWith('businessPartners/')).length,1);
  assert.equal((await call('/portal/login',{email:input.email,phone:input.phone,password:'Wrong123'})).status,401);
  assert.equal((await call('/admin',{}, {'test-role':'collaborator'},'GET')).status,403);
  const list=await (await call('/admin',{}, {'test-role':'admin'},'GET')).json(),id=list.data[0].id;
  assert.equal((await call('/admin/'+id,{status:'approved',conditions:'Condição privada',minimumOrder:500,invite:false},{'test-role':'admin'},'PUT')).status,400);
  const approval=await (await call('/admin/'+id,{status:'approved',conditions:'Condição privada',minimumOrder:500,invite:true},{'test-role':'admin'},'PUT')).json();assert.equal(approval.success,true);const password=new URL(approval.whatsappUrl).searchParams.get('text').match(/temporária ([A-Za-z0-9]+)\./)[1];assert.equal(password.length,16);
  assert.ok(!JSON.stringify([...records.values()]).includes(password));
  let response=await call('/portal/login',{email:input.email,phone:input.phone,password});assert.equal(response.status,200);let session=response.headers.get('set-cookie').split(';')[0];assert.ok(session.startsWith(cookie+'='));assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/Secure/);
  let result=await (await call('/portal/session',{}, {Cookie:session})).json();assert.equal(result.data.mustChangePassword,true);assert.equal(result.data.partner,undefined);assert.ok(!JSON.stringify(result).includes('Condição privada'));
  assert.equal((await call('/portal/session',{}, {Cookie:session.replace(cookie,credentials.cookieName)})).status,401);
  assert.equal((await call('/portal/password',{currentPassword:password,newPassword:'Invalid!1'},{Cookie:session})).status,400);
  assert.equal((await call('/portal/password',{currentPassword:password,newPassword:'Personal123'},{Cookie:session})).status,200);
  assert.equal((await call('/portal/session',{}, {Cookie:session})).status,401);
  response=await call('/portal/login',{email:input.email,phone:input.phone,password:'Personal123'});assert.equal(response.status,200);session=response.headers.get('set-cookie').split(';')[0];
  records.set('businessPartners/other',{company:'PRIVATE OTHER',conditions:'OTHER CONDITIONS'});
  result=await (await call('/portal/session',{partnerId:'other'},{Cookie:session})).json();assert.equal(result.data.partner.company,input.company);assert.equal(result.data.partner.conditions,'Condição privada');assert.ok(!JSON.stringify(result).includes('OTHER'));
  result=await (await call('/admin',{}, {'test-role':'admin'},'GET')).json();assert.ok(!JSON.stringify(result).includes('passwordHash'));
  assert.equal((await call('/admin/'+id,{status:'blocked',conditions:'Condição privada',minimumOrder:500,invite:false},{'test-role':'admin'},'PUT')).status,200);
  assert.equal((await call('/portal/session',{}, {Cookie:session})).status,401);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
