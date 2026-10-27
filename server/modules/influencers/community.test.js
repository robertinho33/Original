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
 records.set('settings/influencerFeatureRollout',{enabled:true,defaults:{followers:true,gallery:true,sharing:true}});
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
 for(const role of [undefined,'collaborator'])for(const action of ['list','rolloutRead','rolloutWrite']){let status;const res={status:value=>{status=value;return res;},json:()=>{}};await handlers[action]({method:action==='rolloutWrite'?'PUT':'GET',admin:role?{role}:null},res);assert.equal(status,403);}
});

test('rollout is hidden by default and blocks public and owner access to already-approved photos',async()=>{
 const {getAccess}=require('./feature-access'),{db,records,service}=setup();records.delete('settings/influencerFeatureRollout');
 assert.deepEqual(await getAccess(db,'one'),{followers:false,gallery:false,sharing:false});
 const id='a'.repeat(32);records.set('influencerGalleryPhotos/'+id,{owner:'one',bytes:Buffer.from('photo'),state:'approved'});
 await assert.rejects(service.photo(id),error=>error.status===404);await assert.rejects(service.photo(id,'one'),error=>error.status===404);
 await assert.rejects(service.gallery('one'),error=>error.status===404);await assert.rejects(service.ownerSummary('one'),error=>error.status===404);
 await assert.rejects(service.upload('one',body),error=>error.status===404);
 await assert.rejects(service.follow('one',{name:'Teste',phone:'11999999999',followConsent:true}),error=>error.status===404);
 assert.equal((await service.photo(id,null,true)).toString(),'photo','admin can still review hidden records');
});

test('global defaults, individual exceptions and the master suspension enforce reversible access with revision protection',async()=>{
 const {getAccess,getSettings,saveSettings}=require('./feature-access'),{db}=setup();
 let global=await getSettings(db);
 global=await saveSettings(db,null,{revision:global.revision,enabled:true,defaults:{followers:false,gallery:false,sharing:false}},'admin');
 await saveSettings(db,'one',{revision:'',followers:true,gallery:false,sharing:'inherit'},'admin');
 assert.deepEqual(await getAccess(db,'one'),{followers:true,gallery:false,sharing:false});assert.deepEqual(await getAccess(db,'two'),{followers:false,gallery:false,sharing:false});
 global=await saveSettings(db,null,{revision:global.revision,enabled:true,defaults:{followers:true,gallery:true,sharing:true}},'admin');
 assert.deepEqual(await getAccess(db,'two'),{followers:true,gallery:true,sharing:true});assert.deepEqual(await getAccess(db,'one'),{followers:true,gallery:false,sharing:true});
 await assert.rejects(saveSettings(db,null,{revision:'',enabled:true,defaults:{followers:true,gallery:true,sharing:true}},'admin'),error=>error.status===409);
 global=await saveSettings(db,null,{revision:global.revision,enabled:false,defaults:global.defaults},'admin');
 assert.deepEqual(await getAccess(db,'one'),{followers:false,gallery:false,sharing:false});
 await saveSettings(db,null,{revision:global.revision,enabled:true,defaults:global.defaults},'admin');assert.equal((await getAccess(db,'one')).gallery,false,'individual block survives collective changes and suspension');
});

test('suspension during analysis prevents saving and opt-out remains possible while disabled',async()=>{
 const {db,records,service}=setup();
 const request=await service.follow('one',{name:'Teste',phone:'11999999999',followConsent:true,marketingConsent:true});
 await service.confirmFollow(request.id,{verifiedInWhatsApp:true,decision:'approve',phone:'11999999999',code:request.code},'admin');
 const racing=createService({getDb:()=>db,getCatalog:async()=>[product],prepareImage:async()=>Buffer.from('photo'),analyzeImage:async()=>{records.delete('settings/influencerFeatureRollout');return {status:'clear'};}});
 await assert.rejects(racing.upload('one',body),error=>error.status===404);assert.equal([...records.keys()].some(key=>key.startsWith('influencerGalleryPhotos/')),false);
 await service.unfollow(request.id,request.secret);assert.equal((await service.followStatus(request.id,request.secret)).status,'cancelled');
 const follower=[...records.entries()].find(([key])=>key.includes('/followers/'))[1];assert.equal(follower.active,false);assert.equal(follower.marketingConsent,false);
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
 const call=(path,method='GET',data,owner='one',origin='https://www.fiosperfeitos.com.br')=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,Referer:'https://www.fiosperfeitos.com.br/pages/vitrine-influenciador.html?loja=one',...(owner?{'x-test-owner':owner}:{})},...(data?{body:JSON.stringify(data)}:{})});
 assert.equal((await call('/owner','GET',null,null)).status,401);
 assert.equal((await call('/owner/photos','POST',body,'one','https://evil.test')).status,403);
 let response=await call('/owner/photos','POST',{...body,owner:'two'});assert.equal(response.status,200);const photo=(await response.json()).data;
 assert.equal((await call('/public/photos/'+photo.id)).status,404);
 assert.equal((await call('/owner/photos/'+photo.id,'GET',null,'two')).status,404);
 assert.equal((await call('/owner/photos/'+photo.id)).headers.get('cache-control'),'no-store');
 const service=createService(deps);await service.reviewPhoto(photo.id,{decision:'approve',safetyConfirmed:true,checklist},'admin');
 response=await call('/public/stores/one/gallery');const gallery=(await response.json()).data.photos;assert.equal(gallery.length,1);assert.ok(!JSON.stringify(gallery).includes('bytes'));assert.ok(!JSON.stringify(gallery).includes('reviewedBy'));
 assert.equal((await call('/public/photos/'+photo.id)).headers.get('content-type'),'image/jpeg');

 assert.equal((await call('/public/photos/'+photo.id+'/interact','POST',{kind:'like'},'one','https://evil.test')).status,403);
 response=await call('/public/photos/'+photo.id+'/interact','POST',{kind:'like'});assert.equal(response.status,403);assert.match((await response.json()).error,/siga este influenciador/);
 response=await call('/public/stores/one/follow','POST',{name:'Pessoa',phone:'11999999999',followConsent:true});const request=(await response.json()).data;assert.deepEqual(Object.keys(request).sort(),['id','secret','status']);
 assert.equal((await call('/owner/followers/'+request.id,'POST',{decision:'accept'},'two')).status,404);
 assert.equal((await call('/owner/followers/'+request.id,'POST',{decision:'accept'},'one','https://evil.test')).status,403);
 assert.equal((await call('/owner/followers/'+request.id,'POST',{decision:'accept'})).status,200);
 assert.equal((await (await call('/public/stores/one/stats')).json()).data.friends,1);
 const interaction={kind:'like',follow:{id:request.id,secret:request.secret}};
 response=await fetch(base+'/public/photos/'+photo.id+'/interact',{method:'POST',headers:{Origin:'https://www.fiosperfeitos.com.br',Referer:'https://www.fiosperfeitos.com.br/index.html','Content-Type':'application/json'},body:JSON.stringify(interaction)});assert.equal(response.status,403);
 response=await call('/public/photos/'+photo.id+'/interact','POST',interaction);assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Lax/i);assert.equal((await response.json()).data.likes,1);
 response=await fetch(base+'/public/photos/'+photo.id+'/interact',{method:'POST',headers:{Origin:'https://www.fiosperfeitos.com.br',Referer:'https://www.fiosperfeitos.com.br/pages/vitrine-influenciador.html?loja=one','Content-Type':'application/json',Cookie:cookie.split(';')[0]},body:JSON.stringify(interaction)});assert.equal((await response.json()).data.likes,1);
 await service.remove('one',photo.id);assert.equal((await call('/public/photos/'+photo.id)).status,404);
});

test('influencers accept their own requests without admin, block and unblock, while contacts and consent stay protected',async()=>{
 const {service,advance,records}=setup();const input={name:'Pessoa',phone:'11999999999',followConsent:true,marketingConsent:false};
 const request=await service.follow('one',input);
 await assert.rejects(service.manageFollower('two',request.id,'accept'),e=>e.status===404);
 const pending=await service.ownerSummary('one');assert.equal(pending.requests.length,1);assert.equal(pending.requests[0].phone,'•••• 9999');assert.ok(!JSON.stringify(pending).includes(input.phone));assert.ok(!JSON.stringify(pending).includes(request.secret));
 await service.manageFollower('one',request.id,'accept');assert.equal((await service.followStatus(request.id,request.secret)).status,'confirmed');assert.equal((await service.publicStats('one')).friends,1);
 await assert.rejects(service.manageFollower('one',request.id,'accept'),e=>e.status===409);
 await service.manageFollower('one',request.id,'block');assert.equal((await service.publicStats('one')).friends,0);assert.equal((await service.ownerSummary('one')).friends[0].blocked,true);
 advance(300001);await assert.rejects(service.follow('one',input),e=>e.status===403);
 await service.manageFollower('one',request.id,'unblock');advance(1);const next=await service.follow('one',input);advance(1);await service.manageFollower('one',next.id,'accept');
 assert.equal((await service.publicStats('one')).friends,1);await service.unfollow(next.id,next.secret);assert.equal((await service.publicStats('one')).friends,0);
 const follower=[...records].find(([k])=>k.includes('/followers/'))[1];assert.equal(follower.marketingConsent,false);assert.equal(follower.phoneVerified,false);
});

test('owner acceptance cannot revive withdrawn consent or bypass rollout',async()=>{
 const {service,records,advance}=setup();const input={name:'Pessoa',phone:'11999999999',followConsent:true};const first=await service.follow('one',input);await service.manageFollower('one',first.id,'accept');advance(300001);const stale=await service.follow('one',input);advance(1);await service.unfollow(first.id,first.secret);await assert.rejects(service.manageFollower('one',stale.id,'accept'),e=>e.status===409);
 records.set('settings/influencerFeatureRollout',{enabled:false});await assert.rejects(service.manageFollower('one',stale.id,'block'),e=>e.status===404);
});

test('only accepted followers of this owner interact; public totals survive blocked, cancelled and deleted links/photos',async()=>{
 const {service,records}=setup();const photo=await service.upload('one',body),a='a'.repeat(64),b='b'.repeat(64);
 const input={name:'Pessoa',phone:'11999999999',followConsent:true};const member=await service.follow('one',input),other=await service.follow('two',input);
 await assert.rejects(service.interact(photo.id,'like',a),e=>e.status===403);
 await assert.rejects(service.interact(photo.id,'like',a,member),e=>e.status===404);
 await service.reviewPhoto(photo.id,{decision:'approve',safetyConfirmed:true,checklist},'admin');
 await assert.rejects(service.interact(photo.id,'like',a,member),e=>e.status===403);
 await service.manageFollower('two',other.id,'accept');await assert.rejects(service.interact(photo.id,'like',a,other),e=>e.status===403);
 await service.manageFollower('one',member.id,'accept');await assert.rejects(service.interact(photo.id,'like',a,{...member,secret:'0'.repeat(64)}),e=>e.status===403);
 await Promise.all(Array.from({length:5},()=>service.interact(photo.id,'like',a,member)));
 assert.deepEqual(await service.interact(photo.id,'want',a,member),{likes:1,wants:1});await service.interact(photo.id,'like',b,member);
 assert.deepEqual(await service.publicStats('one'),{friends:1,likes:2,wants:1});const views=await service.gallery('one');assert.equal(views[0].likes,2);assert.equal(views[0].wants,1);
 assert.ok(!JSON.stringify(views).includes(member.secret));assert.deepEqual(await service.publicStats('two'),{friends:1,likes:0,wants:0});
 await service.manageFollower('one',member.id,'block');await assert.rejects(service.interact(photo.id,'want',b,member),e=>e.status===403);
 assert.equal((await service.gallery('one'))[0].likes,2,'non-followers can still see general counts');
 const second=await service.follow('one',{...input,phone:'11888888888'});await service.manageFollower('one',second.id,'accept');await service.unfollow(second.id,second.secret);await assert.rejects(service.interact(photo.id,'want',b,second),e=>e.status===403);
 records.set('settings/influencerFeatureRollout',{enabled:false});await assert.rejects(service.interact(photo.id,'want',b,member),e=>e.status===404);
 records.set('settings/influencerFeatureRollout',{enabled:true,defaults:{gallery:true,followers:true}});records.set('influencerPublicStores/one',{enabled:true});await service.remove('one',photo.id);assert.deepEqual(await service.publicStats('one'),{friends:0,likes:2,wants:1});await assert.rejects(service.interact(photo.id,'want',b,member),e=>e.status===404);
});
