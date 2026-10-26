'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService,CommunityError}=require('./community-service');
const {prepareImage,analyzeImage,decision}=require('./image-moderation');
function database(){
 const records=new Map();let serial=Promise.resolve();
 const snap=(key,source)=>({id:key.split('/').pop(),exists:source.has(key),data:()=>structuredClone(source.get(key))});
 function ref(key){return {key,id:key.split('/').pop(),collection:name=>query(key+'/'+name),get:async()=>snap(key,records)};}
 function query(name,filters=[],fields=null,limit=Infinity){
  const result=source=>({docs:[...source.keys()].filter(key=>key.startsWith(name+'/')&&!key.slice(name.length+1).includes('/')).filter(key=>filters.every(([field,value])=>source.get(key)[field]===value)).slice(0,limit).map(key=>{const s=snap(key,source);if(fields){const data=s.data;s.data=()=>Object.fromEntries(fields.filter(k=>data()[k]!==undefined).map(k=>[k,data()[k]]));}return s;})});
  return {query:result,doc:id=>ref(name+'/'+id),get:async()=>result(records),where:(field,_op,value)=>query(name,[...filters,[field,value]],fields,limit),orderBy:()=>query(name,filters,fields,limit),limit:value=>query(name,filters,fields,value),select:(...values)=>query(name,filters,values,limit),count:()=>({get:async()=>({data:()=>({count:result(records).docs.length})})})};
 }
 const db={collection:query,runTransaction:fn=>{
  const job=serial.then(async()=>{const draft=structuredClone(records);let wrote=false;const tx={get:async target=>{assert.equal(wrote,false,'reads precede writes');return target.query?target.query(draft):snap(target.key,draft);},set:(target,value)=>{wrote=true;draft.set(target.key,structuredClone(value));},update:(target,value)=>{wrote=true;assert.ok(draft.has(target.key));draft.set(target.key,{...draft.get(target.key),...structuredClone(value)});},delete:target=>{wrote=true;draft.delete(target.key);}};const result=await fn(tx);records.clear();for(const item of draft)records.set(...item);return result;});serial=job.catch(()=>{});return job;
 }};
 for(const owner of ['one','two']){records.set('influencers/'+owner,{active:true});records.set('influencerPublicStores/'+owner,{enabled:true,name:'Vitrine '+owner});}
 return {db,records};
}
const product={sku:'PRODUCT',name:'Shampoo'},body={image:'test',productSku:'PRODUCT',caption:'Uso do produto',policyAccepted:true,rightsConfirmed:true};
function setup(analysis='clear'){const memory=database();let time=Date.now();const service=createService({getDb:()=>memory.db,getCatalog:async()=>[product],prepareImage:async()=>Buffer.from('photo'),analyzeImage:async()=>({status:analysis}),now:()=>time});return {...memory,service,advance:milliseconds=>{time+=milliseconds;}};}
const checklist={adultsOnly:true,noSexualContent:true,noWeaponsDrugsViolence:true,commercialRights:true};
test('photos stay private until automatic analysis plus full admin checklist; ownership and withdrawal are enforced',async()=>{
 const {service}=setup();const photo=await service.upload('one',body);
 assert.equal(photo.state,'pending');assert.deepEqual(await service.gallery('one'),[]);
 await assert.rejects(service.photo(photo.id),error=>error.status===404);
 await assert.rejects(service.photo(photo.id,'two'),error=>error.status===404);
 await assert.rejects(service.remove('two',photo.id),error=>error.status===404);
 assert.equal((await service.photo(photo.id,'one')).toString(),'photo');
 await assert.rejects(service.reviewPhoto(photo.id,{decision:'approve',safetyConfirmed:true},'admin'),/segurança/);
 await service.reviewPhoto(photo.id,{decision:'approve',safetyConfirmed:true,checklist},'admin');
 assert.equal((await service.gallery('one')).length,1);assert.equal((await service.photo(photo.id)).toString(),'photo');
 await service.reviewPhoto(photo.id,{decision:'reject',note:'Inadequada'},'admin');await assert.rejects(service.photo(photo.id),error=>error.status===404);
});
test('six-photo limit remains atomic for concurrent uploads; rejected and unavailable analysis cannot publish',async()=>{
 const {service}=setup();const results=await Promise.allSettled(Array.from({length:7},()=>service.upload('one',body)));assert.equal(results.filter(r=>r.status==='fulfilled').length,6);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const blocked=setup('blocked');await assert.rejects(blocked.service.upload('one',body),error=>error.status===422);assert.equal([...blocked.records.keys()].some(k=>k.startsWith('influencerGalleryPhotos/')),false);
 const unavailable=setup('unavailable'),photo=await unavailable.service.upload('one',body);await assert.rejects(unavailable.service.reviewPhoto(photo.id,{decision:'approve',safetyConfirmed:true,checklist},'admin'),error=>error.status===409);
 await assert.rejects(service.upload('two',{...body,policyAccepted:false}),/regras/);
 await assert.rejects(service.upload('two',{...body,productSku:'UNKNOWN'}),/produto disponível/);
});
test('WhatsApp follows require matching original code and sender, preserve separate consent, deduplicate and allow cancellation',async()=>{
 const {service,advance}=setup();const input={name:'Seguidor',phone:'(11) 99999-9999',followConsent:true,marketingConsent:false};
 const request=await service.follow('one',input);assert.equal((await service.ownerSummary('one')).followers,0);
 assert.equal((await service.followStatus(request.id,request.secret)).status,'pending');
 assert.ok(request.whatsappUrl.startsWith('https://wa.me/5511986215473?text='));
 await assert.rejects(service.followStatus(request.id,'0'.repeat(64)),error=>error.status===401);
 await assert.rejects(service.confirmFollow(request.id,{verifiedInWhatsApp:true,decision:'approve',phone:'11888888888',code:request.code},'admin'),/Número ou código/);
 await service.confirmFollow(request.id,{verifiedInWhatsApp:true,decision:'approve',phone:input.phone,code:request.code},'admin');
 assert.equal((await service.ownerSummary('one')).followers,1);assert.equal((await service.followStatus(request.id,request.secret)).marketingConsent,false);
 await assert.rejects(service.confirmFollow(request.id,{verifiedInWhatsApp:true,decision:'approve',phone:input.phone,code:request.code},'admin'),error=>error.status===409);
 advance(300001);const second=await service.follow('one',{...input,marketingConsent:true});await service.confirmFollow(second.id,{verifiedInWhatsApp:true,decision:'approve',phone:input.phone,code:second.code},'admin');
 assert.equal((await service.ownerSummary('one')).followers,1);await service.unfollow(request.id,request.secret);assert.equal((await service.ownerSummary('one')).followers,1,'old browser cannot cancel newly confirmed ownership');
 advance(300001);const stale=await service.follow('one',input);
 await service.unfollow(second.id,second.secret);assert.equal((await service.ownerSummary('one')).followers,0);
 await assert.rejects(service.confirmFollow(stale.id,{verifiedInWhatsApp:true,decision:'approve',phone:input.phone,code:stale.code},'admin'),error=>error.status===409);
 const queue=await service.adminQueue();assert.equal(JSON.stringify(queue).includes(request.secret),false);assert.equal(JSON.stringify(queue).includes('codeHash'),false);
 advance(300001);const expired=await service.follow('one',input);advance(49*3600000);assert.equal((await service.followStatus(expired.id,expired.secret)).status,'expired');
 await assert.rejects(service.confirmFollow(expired.id,{verifiedInWhatsApp:true,decision:'approve',phone:input.phone,code:expired.code},'admin'),/expirado/);
});
test('moderation thresholds block sexual categories, invalid images fail validation, and bundled free model runs locally',async()=>{
 const values=(Porn=0,Hentai=0,Sexy=0)=>[{className:'Porn',probability:Porn},{className:'Hentai',probability:Hentai},{className:'Sexy',probability:Sexy},{className:'Neutral',probability:1-Porn-Hentai-Sexy},{className:'Drawing',probability:0}];
 assert.equal(decision(values(.4)).status,'blocked');assert.equal(decision(values(0,0,.3)).status,'review');assert.equal(decision([]).status,'unavailable');
 await assert.rejects(prepareImage('data:image/svg+xml;base64,PHN2Zz4='),CommunityError);
 await assert.rejects(prepareImage('data:image/jpeg;base64,aW52YWxpZA=='),CommunityError);
 const sharp=require('sharp'),bytes=await sharp({create:{width:48,height:48,channels:3,background:'#496f42'}}).png().toBuffer();
 const normalized=await prepareImage('data:image/png;base64,'+bytes.toString('base64'));assert.equal((await sharp(normalized).metadata()).format,'jpeg');
 const analysis=await analyzeImage(normalized);assert.ok(['clear','review','blocked'].includes(analysis.status),'real bundled model must complete without an external service');
});
test('administrative queue and private image endpoints reject anonymous and collaborator roles',async()=>{
 const {adminHandlers}=require('./community-routes');const {db}=database();const handlers=adminHandlers({getDb:()=>db});
 for(const role of [undefined,'collaborator']){let status;const res={status:value=>{status=value;return res;},json:()=>{}};await handlers.list({method:'GET',admin:role?{role}:null},res);assert.equal(status,403);}
});

test('HTTP endpoints keep pending photos private, reject forged owners and foreign origins, and return only public gallery fields',async t=>{
 const express=require('express'),credentials=require('./credentials'),{createPublicRouter,createOwnerRouter}=require('./community-routes');
 const {db}=database(),original=credentials.identity;
 credentials.identity=async(_db,req)=>req.get('x-test-owner')?{id:req.get('x-test-owner'),mustChangePassword:false}:null;
 t.after(()=>{credentials.identity=original;});
 const deps={getDb:()=>db,getCatalog:async()=>[product],prepareImage:async()=>Buffer.from('photo'),analyzeImage:async()=>({status:'clear'})};
 const app=express();app.use(express.json());app.use('/public',createPublicRouter(deps));app.use('/owner',createOwnerRouter(deps));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;
 const call=(path,method='GET',data,owner='one',origin='https://www.fiosperfeitos.com.br')=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(owner?{'x-test-owner':owner}:{})},...(data?{body:JSON.stringify(data)}:{})});
 assert.equal((await call('/owner','GET',null,null)).status,401);
 assert.equal((await call('/owner/photos','POST',body,'one','https://evil.test')).status,403);
 let response=await call('/owner/photos','POST',{...body,owner:'two'});assert.equal(response.status,200);const photo=(await response.json()).data;
 assert.equal((await call('/public/photos/'+photo.id)).status,404);
 assert.equal((await call('/owner/photos/'+photo.id,'GET',null,'two')).status,404);
 assert.equal((await call('/owner/photos/'+photo.id)).headers.get('cache-control'),'no-store');
 const service=createService(deps);await service.reviewPhoto(photo.id,{decision:'approve',safetyConfirmed:true,checklist},'admin');
 response=await call('/public/stores/one/gallery');const gallery=(await response.json()).data.photos;assert.equal(gallery.length,1);assert.ok(!JSON.stringify(gallery).includes('bytes'));assert.ok(!JSON.stringify(gallery).includes('reviewedBy'));
 assert.equal((await call('/public/photos/'+photo.id)).headers.get('content-type'),'image/jpeg');
 await service.remove('one',photo.id);assert.equal((await call('/public/photos/'+photo.id)).status,404);
});
