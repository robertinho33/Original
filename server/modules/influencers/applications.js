'use strict';
const {createHash}=require('node:crypto');
const {getFirestore}=require('../../infrastructure/firebase/firebase-admin');
const COLLECTION='influencerApplications';
function invalid(message){const error=Error(message);error.status=400;return error;}
function normalize(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid('Preencha o formulário de candidatura.');
 const result={};
 for(const [key,min,max] of [['name',3,120],['email',5,200],['phone',8,30],['city',2,120],['profileUrl',10,300],['niche',3,200],['audience',10,1000],['salesExperience',10,1500],['contentPlan',20,1500]]){
  const value=typeof input[key]==='string'?input[key].trim():'';
  if(value.length<min||value.length>max)throw invalid('Confira o campo '+key+'.');result[key]=value;
 }
 result.email=result.email.toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw invalid('Informe um e-mail válido.');
 if(!/^[+\d\s()-]{8,30}$/.test(result.phone))throw invalid('Informe um telefone válido.');
 let url;try{url=new URL(result.profileUrl);}catch{throw invalid('Informe o link HTTPS do seu perfil público.');}
 if(url.protocol!=='https:'||url.username||url.password)throw invalid('Informe o link HTTPS do seu perfil público.');
 for(const key of ['followers','averageViews']){
  const number=Number(input[key]);if(input[key]===''||input[key]==null||!Number.isSafeInteger(number)||number<0||number>1000000000)throw invalid('Confira seguidores e visualizações.');result[key]=number;
 }
 if(input.consent!==true||input.adult!==true)throw invalid('Confirme a maioridade e o uso dos dados para análise.');
 return {...result,consent:true,adult:true,consentVersion:'2026-10-29'};
}
async function submit(database,input){
 const data=normalize(input),id=createHash('sha256').update(data.email).digest('hex');
 const ref=database.collection(COLLECTION).doc(id);
 await database.runTransaction(async tx=>{const previous=await tx.get(ref);if(!previous.exists)tx.set(ref,{...data,status:'pending',createdAt:new Date().toISOString()});});
 // Identical response for existing applications avoids disclosing stored contacts.
}
async function review(database,id,decision,admin){
 if(admin?.role!=='admin')throw Object.assign(Error('Acesso restrito ao administrador.'),{status:403});
 if(!/^[a-f0-9]{64}$/.test(id)||!['approved','rejected'].includes(decision))throw invalid('Decisão inválida.');
 const ref=database.collection(COLLECTION).doc(id);
 return database.runTransaction(async tx=>{
  const snapshot=await tx.get(ref);if(!snapshot.exists)throw invalid('Candidatura não encontrada.');
  const row=snapshot.data();if(row.status!=='pending')throw Object.assign(Error('Candidatura já analisada.'),{status:409});
  const now=new Date().toISOString(),update={status:decision,reviewedAt:now,reviewedBy:admin.uid||admin.email};
  if(decision==='approved'){
   const collection=database.collection('influencers'),lock=database.collection('settings').doc('influencer-write-lock');
   await tx.get(lock);const existing=await tx.get(collection);
   if(existing.docs.some(doc=>String(doc.data().email||'').trim().toLowerCase()===row.email))throw Object.assign(Error('Já existe um influenciador com este e-mail. Revise o cadastro existente.'),{status:409});
   const influencer=collection.doc();update.influencerId=influencer.id;
   tx.set(lock,{updatedAt:now,version:require('node:crypto').randomBytes(16).toString('hex')});
   tx.set(influencer,{name:row.name,email:row.email,phone:row.phone,active:false,portalEnabled:false,commissionDefault:0,applicationId:id,createdAt:now,updatedAt:now});
  }
  tx.update(ref,update);return update;
 });
}
function handlers(getDb=getFirestore){
 const fail=(res,error)=>res.status(error.status||503).json({success:false,error:error.status?error.message:'Não foi possível processar a candidatura agora.'});
 return {
  submit:async(req,res)=>{try{const input=normalize(req.body);await submit(getDb(),input);res.status(202).json({success:true,message:'Candidatura recebida. Cadastro sujeito à análise.'});}catch(error){fail(res,error);}},
  list:async(req,res)=>{if(req.admin?.role!=='admin')return res.status(403).json({success:false,error:'Acesso restrito ao administrador.'});try{const rows=await getDb().collection(COLLECTION).orderBy('createdAt','desc').limit(200).get();res.set('Cache-Control','no-store');res.json({success:true,data:rows.docs.map(doc=>({...doc.data(),id:doc.id}))});}catch(error){fail(res,error);}},
  review:async(req,res)=>{try{const data=await review(getDb(),req.params.id,req.body?.decision,req.admin);res.json({success:true,data});}catch(error){fail(res,error);}}
 };
}
function createRouter(){
 const router=require('express').Router(),attempts=new Map();
 router.post('/',(req,res,next)=>{
  const now=Date.now();for(const [key,value] of attempts)if(now-value.start>3600000)attempts.delete(key);
  const key=req.ip||req.socket.remoteAddress;const current=attempts.get(key)||{start:now,count:0};current.count++;attempts.set(key,current);
  res.set('Cache-Control','no-store');if(current.count>5){res.set('Retry-After','3600');return res.status(429).json({success:false,error:'Aguarde antes de tentar novamente.'});}next();
 },require('express').json({limit:'12kb'}),handlers().submit);
 return router;
}
module.exports={normalize,submit,review,handlers,createRouter};
