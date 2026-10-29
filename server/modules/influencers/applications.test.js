'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalize,submit,review,handlers,createRouter}=require('./applications');
const valid={name:'Pessoa Teste',email:'Pessoa@example.com',phone:'11999999999',city:'São Paulo SP',profileUrl:'https://instagram.com/exemplo',niche:'Cuidados capilares',audience:'Pessoas interessadas em cabelos',salesExperience:'Ainda não vendo, quero iniciar.',contentPlan:'Publicar vídeos semanais com indicações de produtos.',followers:100,averageViews:20,adult:true,consent:true};
function database(){const rows=new Map();let sequence=0;return {rows,collection(name){return {doc(id){return {key:name+'/'+(id||'new'+(++sequence)),id:id||'new'+sequence};},name};},async runTransaction(fn){const writes=[];const tx={get:async ref=>ref.name?{docs:[...rows].filter(([key])=>key.startsWith(ref.name+'/')).map(([key,value])=>({id:key.split('/')[1],data:()=>value}))}:{exists:rows.has(ref.key),data:()=>rows.get(ref.key)},set:(ref,data)=>writes.push(()=>rows.set(ref.key,data)),update:(ref,data)=>writes.push(()=>rows.set(ref.key,{...rows.get(ref.key),...data}))};const result=await fn(tx);writes.forEach(fn=>fn());return result;}};}
test('allowlisted application fields and explicit consent',()=>{
 const data=normalize({...valid,role:'admin',portalEnabled:true,status:'approved'});assert.equal(data.email,'pessoa@example.com');assert.equal(data.role,undefined);assert.equal(data.status,undefined);
 for(const change of [{consent:false},{adult:false},{profileUrl:'javascript:alert(1)'},{followers:-1},{averageViews:''},{contentPlan:'x'},{name:'x'.repeat(121)}])assert.throws(()=>normalize({...valid,...change}));
});
test('submission is private, deduplicated and creates no account',async()=>{
 const db=database();await submit(db,valid);await submit(db,{...valid,contentPlan:'Outro plano para publicar vídeos e gerar vendas.'});assert.equal(db.rows.size,1);assert.equal([...db.rows.values()][0].status,'pending');
});
test('only admin may decide; approval creates inactive record without privileges',async()=>{
 const db=database();await submit(db,valid);const id=[...db.rows.keys()][0].split('/')[1];
 for(const admin of [undefined,{role:'collaborator'},{role:'customer'}])await assert.rejects(review(db,id,'approved',admin),{status:403});
 const result=await review(db,id,'approved',{role:'admin',uid:'admin1'});assert.equal(result.reviewedBy,'admin1');const influencer=db.rows.get('influencers/'+result.influencerId);assert.equal(influencer.active,false);assert.equal(influencer.portalEnabled,false);assert.equal(influencer.commissionDefault,0);assert.equal(influencer.role,undefined);
 await assert.rejects(review(db,id,'rejected',{role:'admin',uid:'admin1'}),{status:409});
});
test('rejection and duplicate approval never create an influencer',async()=>{
 const db=database();await submit(db,valid);const id=[...db.rows.keys()][0].split('/')[1];db.rows.set('influencers/existing',{email:valid.email.toLowerCase()});await assert.rejects(review(db,id,'approved',{role:'admin',uid:'a'}),{status:409});assert.equal(db.rows.get('influencerApplications/'+id).status,'pending');await review(db,id,'rejected',{role:'admin',uid:'a'});assert.equal([...db.rows.keys()].filter(key=>key.startsWith('influencers/')).length,1);
});
test('listing denies non-admin before database access',async()=>{let code;await handlers(()=>{throw Error('must not access');}).list({admin:{role:'collaborator'}},{status(n){code=n;return this;},json(){}});assert.equal(code,403);});
test('admin HTTP endpoints require authentication before reading applications',async t=>{
 const express=require('express'),app=express(),router=express.Router();router.use(require('../admin/admin-auth'));const secured=handlers(()=>{throw Error('must not access');});router.get('/influencer-applications',secured.list);router.put('/influencer-applications/:id',secured.review);app.use('/api/admin',router);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.close();server.closeAllConnections();});
 const base='http://127.0.0.1:'+server.address().port+'/api/admin/influencer-applications';
 assert.equal((await fetch(base)).status,401);assert.equal((await fetch(base+'/'+'a'.repeat(64),{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"decision":"approved"}'})).status,401);
});
test('public endpoint limits repeated submissions',async t=>{
 const app=require('express')();app.use('/apply',createRouter());const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
 const url='http://127.0.0.1:'+server.address().port+'/apply';for(let i=0;i<5;i++)assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,400);
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,429);
});
