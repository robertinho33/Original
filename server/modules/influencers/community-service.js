'use strict';
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {phone}=require('./credentials');
const {getAccess}=require('./feature-access');
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const idValid=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id);
const secretValid=secret=>typeof secret==='string'&&/^[a-f0-9]{64}$/.test(secret);
class CommunityError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new CommunityError(status,message);};
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
function photoView(id,data){return {id,likes:Number(data.likes)||0,wants:Number(data.wants)||0,caption:clean(data.caption,240),productSku:clean(data.productSku,100),state:data.state,analysis:data.analysis,createdAt:data.createdAt,reviewNote:clean(data.reviewNote,240),imageUrl:'/api/community/photos/'+encodeURIComponent(id)};}
function createService({getDb,analyzeImage=bytes=>require('./image-moderation').analyzeImage(bytes),prepareImage=body=>require('./image-moderation').prepareImage(body),getCatalog=()=>require('./discovery').publicCatalog(),now=()=>Date.now()}){
 const db=()=>getDb();
 async function requireFeature(owner,key,tx){if(!(await getAccess(db(),owner,tx))[key])fail(404,'Recurso indisponível.');}
 async function publicStore(owner){
  if(!idValid(owner))fail(400,'Vitrine inválida.');
  const [store,person]=await Promise.all([db().collection('influencerPublicStores').doc(owner).get(),db().collection('influencers').doc(owner).get()]);
  if(!store.exists||store.data().enabled!==true||!person.exists||person.data().active===false)fail(404,'Esta vitrine não está disponível.');
  return store.data();
 }
 async function gallery(owner,privateView=false){
  if(!privateView){await requireFeature(owner,'gallery');await publicStore(owner);}
  const community=await db().collection('influencerCommunities').doc(owner).get();
  const ids=community.exists&&Array.isArray(community.data().photoIds)?community.data().photoIds.slice(0,6):[];
  const docs=await Promise.all(ids.map(id=>db().collection('influencerGalleryPhotos').doc(id).get()));
  return docs.filter(doc=>doc.exists&&doc.data().owner===owner&&(privateView||doc.data().state==='approved')).map(doc=>photoView(doc.id,doc.data()));
 }
 async function photo(id,owner=null,admin=false){
  if(!/^[a-f0-9]{32}$/.test(id))fail(404,'Foto indisponível.');
  const doc=await db().collection('influencerGalleryPhotos').doc(id).get();
  if(!doc.exists)fail(404,'Foto indisponível.');const data=doc.data();
  if(!admin)await requireFeature(data.owner,'gallery');
  if(!admin&&owner!==data.owner){if(data.state!=='approved')fail(404,'Foto indisponível.');await publicStore(data.owner);}
  if(!data.bytes)fail(404,'Foto indisponível.');return Buffer.from(data.bytes);
 }
 async function upload(owner,body){
  await requireFeature(owner,'gallery');
  if(body?.policyAccepted!==true||body?.rightsConfirmed!==true)fail(400,'Confirme as regras e a autorização de uso da foto.');
  const productSku=clean(body.productSku,100),catalog=await getCatalog();
  if(!catalog.some(p=>p.sku===productSku))fail(400,'Escolha um produto disponível para esta foto.');
  const slots=db().collection('influencerCommunities').doc(owner),before=await slots.get();
  if((before.exists?before.data().photoIds||[]:[]).length>=6)fail(409,'Limite de seis fotos. Remova uma antes de enviar outra.');
  const bytes=await prepareImage(body.image);
  const analysis=await analyzeImage(bytes);
  if(analysis.status==='blocked')fail(422,'A triagem identificou possível nudez ou conteúdo sugestivo. Esta foto não será publicada.');
  const id=randomBytes(16).toString('hex'),ref=db().collection('influencerGalleryPhotos').doc(id);
  const data={owner,caption:clean(body.caption,240),productSku,bytes,state:'pending',analysis:['clear','review'].includes(analysis.status)?analysis.status:'unavailable',createdAt:new Date(now()).toISOString(),policyVersion:'2026-10-26',rightsConfirmed:true};
  await db().runTransaction(async tx=>{
   await requireFeature(owner,'gallery',tx);
   const snapshot=await tx.get(slots),current=snapshot.exists?snapshot.data():{},ids=Array.isArray(current.photoIds)?current.photoIds:[];
   if(ids.length>=6)fail(409,'Limite de seis fotos.');
   tx.set(ref,data);tx.set(slots,{...current,photoIds:[...ids,id]});
  });return photoView(id,data);
 }
 async function remove(owner,id){
  await requireFeature(owner,'gallery');
  const ref=db().collection('influencerGalleryPhotos').doc(id),slots=db().collection('influencerCommunities').doc(owner);
  await db().runTransaction(async tx=>{
   const [doc,snapshot]=await Promise.all([tx.get(ref),tx.get(slots)]);
   if(!doc.exists||doc.data().owner!==owner)fail(404,'Foto indisponível.');
   const current=snapshot.exists?snapshot.data():{};
   tx.delete(ref);tx.set(slots,{...current,photoIds:(current.photoIds||[]).filter(value=>value!==id)});
  });
 }
 async function reviewPhoto(id,body,actor){
  const ref=db().collection('influencerGalleryPhotos').doc(id);
  if(!['approve','reject'].includes(body?.decision))fail(400,'Escolha aprovar ou rejeitar.');
  if(body.decision==='approve'&&(body.safetyConfirmed!==true||!['adultsOnly','noSexualContent','noWeaponsDrugsViolence','commercialRights'].every(key=>body.checklist?.[key]===true)))fail(400,'Confira todos os itens de segurança antes de aprovar.');
  await db().runTransaction(async tx=>{
   const doc=await tx.get(ref);if(!doc.exists)fail(404,'Foto indisponível.');const data=doc.data();
   if(body.decision==='approve'&&(!data.bytes||!['clear','review'].includes(data.analysis)||data.state==='rejected'))fail(409,'A análise automática precisa terminar antes da aprovação. Reenvie fotos rejeitadas.');
   tx.update(ref,{state:body.decision==='approve'?'approved':'rejected',...(body.decision==='reject'?{bytes:null}:{}),reviewNote:clean(body.note,240),reviewedBy:actor,reviewedAt:new Date(now()).toISOString(),safetyConfirmed:body.decision==='approve',...(body.decision==='approve'?{reviewChecklist:{adultsOnly:true,noSexualContent:true,noWeaponsDrugsViolence:true,commercialRights:true}}:{})});
  });
 }
 async function rescan(id){
  const ref=db().collection('influencerGalleryPhotos').doc(id),doc=await ref.get();
  if(!doc.exists||doc.data().state!=='pending'||!doc.data().bytes)fail(409,'Somente fotos pendentes podem ser reanalisadas.');
  const analysis=await analyzeImage(Buffer.from(doc.data().bytes));
  await db().runTransaction(async tx=>{
   const current=await tx.get(ref);if(!current.exists||current.data().state!=='pending')fail(409,'A foto mudou; atualize a lista.');
   tx.update(ref,{analysis:analysis.status,...(analysis.status==='blocked'?{state:'rejected',bytes:null,reviewNote:'Bloqueada pela triagem automática.'}:{})});
  });
 }
 async function follow(owner,body){
  await requireFeature(owner,'followers');
  const store=await publicStore(owner),name=clean(body?.name,100),number=phone(body?.phone);
  if(!name||!/^\d{10,11}$/.test(number)||body.followConsent!==true)fail(400,'Informe nome, WhatsApp com DDD e autorize o acompanhamento.');
  const id=randomBytes(16).toString('hex'),secret=randomBytes(32).toString('hex'),code=randomBytes(6).toString('hex').toUpperCase(),createdAt=new Date(now()).toISOString();
  const ref=db().collection('communityFollowRequests').doc(id),limit=db().collection('communityFollowLimits').doc(digest(owner+':'+number));
  await db().runTransaction(async tx=>{
   await requireFeature(owner,'followers',tx);
   const existing=await tx.get(followerRef({owner,phone:number}));if(existing.exists&&existing.data().blocked===true)fail(403,'Este acompanhamento está bloqueado pelo influenciador.');
   const previous=await tx.get(limit);if(previous.exists&&now()-previous.data().createdAt<300000)fail(429,'Já há um pedido recente para esse WhatsApp. Aguarde cinco minutos.');
   tx.set(ref,{owner,name,phone:number,managementHash:digest(secret),codeHash:digest(code),status:'pending',followConsent:true,marketingConsent:body.marketingConsent===true,consentVersion:'2026-10-26',createdAt,expiresAt:now()+48*3600000});tx.set(limit,{createdAt:now()});
  });
  const message='Olá! Quero seguir '+clean(store.name,100)+' na Fios Perfeitos. Meu nome: '+name+'. WhatsApp cadastrado: '+number+'. Código de confirmação: '+code+'. '+(body.marketingConsent===true?'Também autorizo receber novidades pelo WhatsApp.':'Não autorizo mensagens de novidades pelo WhatsApp.');
  return {id,secret,code,status:'pending',whatsappUrl:'https://wa.me/5511986215473?text='+encodeURIComponent(message)};
 }
 async function ownRequest(id,secret){
  if(!/^[a-f0-9]{32}$/.test(id)||!secretValid(secret))fail(401,'Confirmação não encontrada neste aparelho.');
  const ref=db().collection('communityFollowRequests').doc(id),doc=await ref.get();
  if(!doc.exists||!timingSafeEqual(Buffer.from(doc.data().managementHash||'','hex'),Buffer.from(digest(secret),'hex')))fail(401,'Confirmação não encontrada neste aparelho.');return {ref,data:doc.data()};
 }
 function followerRef(data){return db().collection('influencerCommunities').doc(data.owner).collection('followers').doc(digest(data.phone));}
 async function followStatus(id,secret){
  const {data}=await ownRequest(id,secret);let status=data.status;
  if(status==='pending'&&data.expiresAt<=now())status='expired';
  if(['pending','confirmed'].includes(status)){const target=await followerRef(data).get();if(target.exists&&target.data().blocked===true)status='blocked';}
  if(status==='confirmed'){const follower=await followerRef(data).get();if(!follower.exists||!follower.data().active||follower.data().managementHash!==data.managementHash)status='inactive';}
  return {status,marketingConsent:data.marketingConsent===true};
 }
 async function unfollow(id,secret){
  const {ref,data}=await ownRequest(id,secret),target=followerRef(data);
  await db().runTransaction(async tx=>{const [request,follower]=await Promise.all([tx.get(ref),tx.get(target)]);if(!request.exists)fail(404,'Pedido não encontrado.');tx.update(ref,{status:'cancelled',cancelledAt:new Date(now()).toISOString()});if(follower.exists&&follower.data().managementHash===data.managementHash)tx.update(target,{active:false,marketingConsent:false,withdrawnAt:new Date(now()).toISOString(),consentUpdatedAt:now()});});
 }
 async function confirmFollow(id,body,actor){
  const ref=db().collection('communityFollowRequests').doc(id);
  if(body?.verifiedInWhatsApp!==true||!['approve','reject'].includes(body.decision))fail(400,'Confira o número e o código na conversa recebida pelo WhatsApp.');
  await db().runTransaction(async tx=>{
   const doc=await tx.get(ref);if(!doc.exists||doc.data().status!=='pending')fail(409,'Este pedido não está pendente.');const data=doc.data();
   if(data.expiresAt<=now())fail(409,'Pedido expirado. O visitante deve solicitar novamente.');
   if(phone(body.phone)!==data.phone||digest(clean(body.code,30).toUpperCase())!==data.codeHash)fail(400,'Número ou código não corresponde à mensagem recebida.');
   if(body.decision==='approve')await requireFeature(data.owner,'followers',tx);
   const target=followerRef(data),follower=await tx.get(target);
   if(body.decision==='approve'&&follower.exists&&follower.data().blocked===true)fail(403,'Acompanhamento bloqueado pelo influenciador.');
   if(body.decision==='approve'&&follower.exists&&Number(follower.data().consentUpdatedAt)>=Date.parse(data.createdAt))fail(409,'Este pedido é anterior à última alteração ou cancelamento. Solicite uma nova confirmação.');
   tx.update(ref,{status:body.decision==='approve'?'confirmed':'rejected',reviewedBy:actor,reviewedAt:new Date(now()).toISOString()});
   if(body.decision==='approve')tx.set(target,{name:data.name,phone:data.phone,active:true,sourceRequestId:id,managementHash:data.managementHash,followConsent:true,marketingConsent:data.marketingConsent,consentVersion:data.consentVersion,consentedAt:data.createdAt,consentUpdatedAt:Date.parse(data.createdAt),confirmedAt:new Date(now()).toISOString(),confirmedBy:actor});
  });
 }
 async function stats(owner){return require('./community-stats').communityStats(db(),owner);}
 async function publicStats(owner){await publicStore(owner);const features=await getAccess(db(),owner);if(!features.followers&&!features.gallery)fail(404,'Recurso indisponível.');const result=await stats(owner);return {friends:features.followers?result.friends:0,likes:features.gallery?result.likes:0,wants:features.gallery?result.wants:0};}
 async function productReactions(){
  const [photos,totals]=await Promise.all([db().collection('influencerGalleryPhotos').select('productSku','likes','wants').get(),db().collection('communityProductMetrics').select('sku','likes','wants').get()]);
  const rows=new Map();for(const doc of photos.docs){const data=doc.data();if(!data.productSku)continue;const row=rows.get(data.productSku)||{sku:data.productSku,likes:0,wants:0};row.likes+=Math.max(0,Number(data.likes)||0);row.wants+=Math.max(0,Number(data.wants)||0);rows.set(row.sku,row);}
  for(const doc of totals.docs){const data=doc.data();if(data.sku)rows.set(data.sku,{sku:data.sku,likes:Math.max(0,Number(data.likes)||0),wants:Math.max(0,Number(data.wants)||0)});}
  return [...rows.values()];
 }
 async function interact(id,kind,visitor,membership){
  if(!/^[a-f0-9]{32}$/.test(id)||!['like','want'].includes(kind)||!secretValid(visitor))fail(400,'Interação inválida.');
  const followMessage='Para curtir ou marcar Quero, siga este influenciador e aguarde seu pedido ser aceito.';
  if(!/^[a-f0-9]{32}$/.test(membership?.id||'')||!secretValid(membership?.secret))fail(403,followMessage);
  const ref=db().collection('influencerGalleryPhotos').doc(id),ledger=db().collection('communityPhotoInteractions').doc(digest(id+':'+visitor));
  return db().runTransaction(async tx=>{
   const photo=await tx.get(ref);if(!photo.exists||photo.data().state!=='approved')fail(404,'Foto indisponível.');const data=photo.data();await requireFeature(data.owner,'gallery',tx);await requireFeature(data.owner,'followers',tx);
   const request=await tx.get(db().collection('communityFollowRequests').doc(membership.id));
   if(!request.exists||request.data().owner!==data.owner||request.data().status!=='confirmed'||request.data().managementHash!==digest(membership.secret))fail(403,followMessage);
   const follower=await tx.get(followerRef(request.data()));
   if(!follower.exists||follower.data().active!==true||follower.data().blocked===true||follower.data().managementHash!==request.data().managementHash)fail(403,followMessage);
   const parent=db().collection('influencerCommunities').doc(data.owner);
   const [store,person,previous,summary]=await Promise.all([tx.get(db().collection('influencerPublicStores').doc(data.owner)),tx.get(db().collection('influencers').doc(data.owner)),tx.get(ledger),tx.get(parent)]);
   if(!store.exists||store.data().enabled!==true||!person.exists||person.data().active===false)fail(404,'Vitrine indisponível.');
   const field=kind==='like'?'likes':'wants',old=previous.exists?previous.data():{},current=summary.exists?summary.data():{},totals=current.reactionTotals||{};
   const count=Math.max(0,Number(data[field])||0)+(old[kind]===true?0:1);
   let productRef,productTotals;
   if(old[kind]!==true&&data.productSku){
    productRef=db().collection('communityProductMetrics').doc(digest(data.productSku));const product=await tx.get(productRef);
    if(product.exists)productTotals=product.data();else{const related=await tx.get(db().collection('influencerGalleryPhotos').where('productSku','==',data.productSku).select('likes','wants'));productTotals={sku:data.productSku,likes:0,wants:0};for(const doc of related.docs){productTotals.likes+=Math.max(0,Number(doc.data().likes)||0);productTotals.wants+=Math.max(0,Number(doc.data().wants)||0);}}
   }

   if(old[kind]!==true){if(productRef)tx.set(productRef,{sku:data.productSku,likes:Math.max(0,Number(productTotals.likes)||0),wants:Math.max(0,Number(productTotals.wants)||0),[field]:Math.max(0,Number(productTotals[field])||0)+1});tx.update(ref,{[field]:count});tx.set(ledger,{...old,[kind]:true,owner:data.owner,photoId:id,updatedAt:new Date(now()).toISOString()});tx.set(parent,{...current,reactionTotals:{...totals,[field]:(Number(totals[field])||0)+1}});}
   return {likes:field==='likes'?count:Number(data.likes)||0,wants:field==='wants'?count:Number(data.wants)||0};
  });
 }
 async function manageFollower(owner,id,decision){
  if(!/^[a-f0-9]{32}$/.test(id)||!['accept','block','unblock'].includes(decision))fail(400,'Ação inválida.');
  const ref=db().collection('communityFollowRequests').doc(id);
  await db().runTransaction(async tx=>{
   await requireFeature(owner,'followers',tx);const doc=await tx.get(ref);
   if(!doc.exists||doc.data().owner!==owner)fail(404,'Pedido não encontrado.');const data=doc.data(),target=followerRef(data),follower=await tx.get(target),current=follower.exists?follower.data():{};
   const stamp=new Date(now()).toISOString();
   if(decision==='accept'){
    if(data.status!=='pending'||data.expiresAt<=now())fail(409,'Este pedido não está pendente ou expirou.');
    if(current.blocked===true)fail(409,'Desbloqueie esta pessoa antes de aceitar um novo pedido.');
    if(Number(current.consentUpdatedAt)>=Date.parse(data.createdAt))fail(409,'Pedido anterior ao último cancelamento. Aguarde uma nova solicitação.');
    tx.set(target,{name:data.name,phone:data.phone,active:true,blocked:false,sourceRequestId:id,managementHash:data.managementHash,followConsent:true,marketingConsent:data.marketingConsent===true,consentVersion:data.consentVersion,consentedAt:data.createdAt,consentUpdatedAt:Date.parse(data.createdAt),confirmedAt:stamp,confirmedBy:owner,phoneVerified:false});
    tx.update(ref,{status:'confirmed',reviewedBy:owner,reviewedAt:stamp});
   }else{
    if(decision==='unblock'&&current.blocked!==true)fail(409,'Esta pessoa não está bloqueada.');
    tx.set(target,{...current,name:current.name||data.name,phone:data.phone,sourceRequestId:id,active:false,blocked:decision==='block',marketingConsent:false,consentUpdatedAt:now(),reviewedAt:stamp,reviewedBy:owner});
    tx.update(ref,{status:decision==='block'?'blocked':'inactive',reviewedBy:owner,reviewedAt:stamp});
   }
  });
 }
 async function ownerSummary(owner){
  const features=await getAccess(db(),owner);if(!features.followers&&!features.gallery)fail(404,'Recurso indisponível.');
  const [counts,requests,followers]=await Promise.all([stats(owner),features.followers?db().collection('communityFollowRequests').where('owner','==',owner).select('name','phone','status','createdAt','expiresAt','managementHash').get():null,features.followers?db().collection('influencerCommunities').doc(owner).collection('followers').get():null]);
  const rows=requests?requests.docs.map(d=>({id:d.id,...d.data()})):[];
  const blockedNumbers=new Set((followers?followers.docs:[]).filter(d=>d.data().blocked===true).map(d=>d.data().phone));
  const view=r=>({id:r.id,name:r.name,phone:'•••• '+String(r.phone||'').slice(-4),createdAt:r.createdAt});
  const friends=(followers?followers.docs:[]).map(d=>d.data()).filter(d=>d.active||d.blocked).map(d=>{const source=rows.find(r=>r.id===d.sourceRequestId)||rows.find(r=>r.managementHash===d.managementHash);return source?{...view({...source,name:d.name}),blocked:d.blocked===true}:null;}).filter(Boolean);
  return {features,followers:features.followers?counts.friends:0,stats:counts,requests:rows.filter(r=>r.status==='pending'&&r.expiresAt>now()&&!blockedNumbers.has(r.phone)).map(view),friends,photos:features.gallery?await gallery(owner,true):[]};
 }
 async function adminQueue(owner){
  if(owner&&!idValid(owner))fail(400,'Influenciador inválido.');
  if(owner){
   const [photos,requests]=await Promise.all([gallery(owner,true),db().collection('communityFollowRequests').where('owner','==',owner).select('owner','name','phone','status','marketingConsent','createdAt','expiresAt').get()]);
   const rows=requests.docs.map(doc=>({id:doc.id,...doc.data(),status:doc.data().status==='pending'&&doc.data().expiresAt<=now()?'expired':doc.data().status}));
   rows.sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending')||(a.status==='pending'?String(a.createdAt).localeCompare(String(b.createdAt)):String(b.createdAt).localeCompare(String(a.createdAt))));
   return {photos:photos.map(photo=>({...photo,owner})),requests:rows.slice(0,100)};
  }
  const [photos,requests]=await Promise.all([
   db().collection('influencerGalleryPhotos').orderBy('createdAt','desc').limit(100).select('owner','caption','productSku','state','analysis','createdAt','reviewNote').get(),
   db().collection('communityFollowRequests').orderBy('createdAt','desc').limit(100).select('owner','name','phone','status','marketingConsent','createdAt','expiresAt').get()
  ]);
  return {photos:photos.docs.map(doc=>({...photoView(doc.id,doc.data()),owner:doc.data().owner})),requests:requests.docs.map(doc=>({id:doc.id,...doc.data(),status:doc.data().status==='pending'&&doc.data().expiresAt<=now()?'expired':doc.data().status}))};
 }
 return {productReactions,stats,publicStats,interact,manageFollower,gallery,photo,upload,remove,reviewPhoto,rescan,follow,followStatus,unfollow,confirmFollow,ownerSummary,adminQueue};
}
module.exports={createService,CommunityError,digest};
