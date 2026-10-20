'use strict';
const express=require('express');
const {getFirestore}=require('../../infrastructure/firebase/firebase-admin');
const text=(value,max=200)=>String(value??'').trim().slice(0,max);
const key=value=>text(value,100).toLowerCase();
const goals=['hydration','repair','frizz','curls','color'];
const steps=['wash','treat','finish'];
function safeImage(value){try{const url=new URL(text(value,1600));return url.protocol==='https:'?url.href:'';}catch{return '';}}
function productView(p){return {sku:text(p.sku,100),name:text(p.name),image:safeImage(p.image),price:Number(p.price)};}
async function publicCatalog(){
  const [products,visibility]=await Promise.all([require('../catalog/catalog-storefront-service').getPublicCatalog(),require('../catalog/catalog-visibility-service').getVisibility()]);
  const visible=new Set(visibility.sources.filter(s=>s.visible).map(s=>key(s.id))),hidden=new Set(visibility.inactiveProductSkus.map(key));
  return products.filter(p=>p.active!==false&&!/^inativo/i.test(p.name)&&!hidden.has(key(p.sku))&&(!p.sourceId||visible.has(key(p.sourceId)))&&Number.isFinite(Number(p.price))&&Number(p.price)>0&&Number(p.stock)>0);
}
function normalizeRules(body={}){
  if(!Array.isArray(body.rules)||body.rules.length>30)throw Error('Cadastre no máximo 30 recomendações.');
  const seen=new Set();
  const rules=body.rules.map(row=>{
    const rule={sku:text(row.sku,100),goal:text(row.goal,30),step:text(row.step,20),hair:text(row.hair||'all',20),chemistry:text(row.chemistry||'all',20),reason:text(row.reason,400)};
    if(!rule.sku||!goals.includes(rule.goal)||!steps.includes(rule.step)||!['all','straight','wavy','curly','coily'].includes(rule.hair)||!['all','treated','natural'].includes(rule.chemistry)||!rule.reason)throw Error('Complete produto, objetivo, etapa e motivo da indicação.');
    const id=[key(rule.sku),rule.goal,rule.hair,rule.chemistry].join(':');if(seen.has(id))throw Error('Há recomendações repetidas para o mesmo perfil.');seen.add(id);return rule;
  });
  return {enabled:body.enabled===true,rules};
}
function recommend(config,catalog,input={}){
  if(!goals.includes(input.goal)||!['straight','wavy','curly','coily'].includes(input.hair)||!['treated','natural'].includes(input.chemistry))throw Error('Confira as respostas do seu ritual.');
  const budget=Number(input.budget);if(!Number.isFinite(budget)||budget<=0||budget>10000)throw Error('Informe um orçamento entre R$ 1 e R$ 10.000.');
  if(!config?.enabled)return {products:[],total:0,message:'A loja está preparando as recomendações. Fale conosco para montar seu ritual.'};
  const matches=(config.rules||[]).filter(r=>r.goal===input.goal&&(r.hair==='all'||r.hair===input.hair)&&(r.chemistry==='all'||r.chemistry===input.chemistry));
  const result=[];let cents=0;
  // Treatment is the first priority; choose one affordable product per step, without duplicate SKUs.
  for(const step of ['treat','wash','finish']){
    const candidates=matches.filter(r=>r.step===step).map(r=>({r,p:catalog.find(p=>key(p.sku)===key(r.sku))})).filter(({p})=>p&&p.active!==false&&Number(p.stock)>0&&Number(p.price)>0&&Number.isFinite(Number(p.price))&&!result.some(row=>key(row.sku)===key(p.sku)))
      .sort((a,b)=>Number(a.p.price)-Number(b.p.price)||key(a.p.sku).localeCompare(key(b.p.sku)));
    const choice=candidates.find(({p})=>cents+Math.round(Number(p.price)*100)<=Math.floor(budget*100));
    if(choice){cents+=Math.round(Number(choice.p.price)*100);result.push({...productView(choice.p),step,reason:choice.r.reason});}
  }
  result.sort((a,b)=>steps.indexOf(a.step)-steps.indexOf(b.step));
  return {products:result,total:cents/100,message:result.length===3?'Seu ritual reúne três etapas dentro do orçamento.':result.length?'Montamos uma seleção parcial dentro do orçamento e das indicações disponíveis.':'Não encontramos uma indicação disponível dentro desse orçamento. Você pode ajustar o valor ou falar com a loja.'};
}
function normalizeStore(body={}){
  const skus=Array.isArray(body.skus)?body.skus.map(s=>text(s,100)).filter(Boolean):[];
  if(skus.length>6||new Set(skus.map(key)).size!==skus.length)throw Error('Escolha até seis produtos diferentes.');
  const result={enabled:body.enabled===true,name:text(body.name,100),bio:text(body.bio,500),image:safeImage(body.image),videoUrl:'',coupon:text(body.coupon,60).toUpperCase(),skus};
  if(body.videoUrl){try{const url=new URL(body.videoUrl);if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','youtu.be','instagram.com','www.instagram.com','tiktok.com','www.tiktok.com'].includes(url.hostname))throw Error();result.videoUrl=url.href;}catch{throw Error('Use um link HTTPS do YouTube, Instagram ou TikTok.');}}
  if(result.enabled&&(!result.name||!skus.length||!result.coupon))throw Error('Para ativar, preencha nome público, cupom vinculado e ao menos um produto.');
  return result;
}
async function validCoupon(db,code,id){
  if(!code)return '';
  const snap=await db.collection('coupons').get();
  const coupon=snap.docs.map(d=>d.data()).find(c=>key(c.code||c.couponCode||c.coupon_code)===key(code)&&String(c.influencerId||c.influencer_id||'')===id&&c.active!==false);
  return coupon?text(code,60).toUpperCase():'';
}
function projectStore(config,catalog,coupon){
  return {name:config.name,bio:config.bio,image:config.image,videoUrl:config.videoUrl,coupon,products:config.skus.map(sku=>catalog.find(p=>key(p.sku)===key(sku))).filter(Boolean).map(productView)};
}
function createRouter(deps={}){
  const router=express.Router(),db=deps.getDb||getFirestore,getCatalog=deps.getCatalog||publicCatalog;
  const requests=new Map();
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store');const now=Date.now(),id=req.ip||'local';
    if(requests.size>5000)for(const [key,value] of requests)if(value.until<now)requests.delete(key);
    const previous=requests.get(id),entry=previous?.until>now?previous:{count:0,until:now+60000};entry.count++;requests.set(id,entry);
    if(entry.count>30)return res.status(429).json({success:false,error:'Aguarde um minuto antes de consultar novamente.'});next();
  });
  router.get('/stores/:id',async(req,res)=>{try{
    const id=text(req.params.id,100),[store,person,catalog]=await Promise.all([db().collection('influencerPublicStores').doc(id).get(),db().collection('influencers').doc(id).get(),getCatalog()]);
    if(!store.exists||!person.exists||person.data().active===false||!store.data().enabled)return res.status(404).json({success:false,error:'Esta vitrine não está disponível.'});
    const config=normalizeStore(store.data()),coupon=await validCoupon(db(),config.coupon,id);
    if(!coupon)return res.status(404).json({success:false,error:'Esta vitrine está temporariamente indisponível.'});
    res.json({success:true,data:projectStore(config,catalog,coupon)});
  }catch{res.status(503).json({success:false,error:'Não foi possível carregar esta vitrine.'});}});
  router.post('/ritual',async(req,res)=>{try{
    const [snapshot,catalog]=await Promise.all([db().collection('storeRitualRules').doc('current').get(),getCatalog()]);
    res.json({success:true,data:recommend(snapshot.exists?snapshot.data():null,catalog,req.body)});
  }catch(error){res.status(error.message.startsWith('Confira')||error.message.startsWith('Informe')?400:503).json({success:false,error:error.message.startsWith('Confira')||error.message.startsWith('Informe')?error.message:'Não foi possível montar seu ritual agora.'});}});
  return router;
}
function admin(kind,write=false){return async(req,res)=>{
  if(req.admin?.role!=='admin')return res.status(403).json({success:false,error:'Acesso restrito ao administrador.'});
  try{
    const db=getFirestore(),id=kind==='store'?text(req.params.id,100):'current',ref=db.collection(kind==='store'?'influencerPublicStores':'storeRitualRules').doc(id);
    const catalog=await publicCatalog();
    if(!write){const snap=await ref.get();return res.json({success:true,data:snap.exists?snap.data():{},catalog:catalog.map(productView)});}
    let data;
    try{data=kind==='store'?normalizeStore(req.body):normalizeRules(req.body);
      const skus=kind==='store'?data.skus:data.rules.map(r=>r.sku);if(data.enabled&&skus.some(sku=>!catalog.some(p=>key(p.sku)===key(sku))))throw Error('Escolha produtos visíveis e disponíveis no catálogo.');
      if(kind==='store'){const person=await db.collection('influencers').doc(id).get();if(!person.exists||(data.enabled&&person.data().active===false))throw Error('O influenciador precisa estar ativo.');if(data.enabled&&!await validCoupon(db,data.coupon,id))throw Error('O cupom precisa estar ativo e vinculado a este influenciador.');}
    }catch(error){return res.status(400).json({success:false,error:error.message});}
    await ref.set({...data,updatedAt:new Date().toISOString(),updatedBy:req.admin.uid||req.admin.email||'admin'});res.json({success:true,data});
  }catch{res.status(503).json({success:false,error:'Não foi possível acessar a configuração.'});}
};}
module.exports={createRouter,admin,normalizeRules,recommend,normalizeStore,projectStore,publicCatalog};
