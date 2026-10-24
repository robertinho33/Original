'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {dimensions,mayMeasure,recordInterest,dayKey,reportFilters,summarize,report}=require('./care-interests');
const input={hair:'curly',chemistry:'treated',goal:'hydration',budget:150};
function fakeDb(){const rows=new Map();let queue=Promise.resolve();const collection=name=>({doc:id=>({key:name+'/'+id,get:async()=>({exists:rows.has(name+'/'+id),data:()=>rows.get(name+'/'+id)})}),where(){return this;},limit(){return this;},get:async()=>({docs:[...rows.entries()].filter(([key])=>key.startsWith(name+'/')).map(([,v])=>({data:()=>v}))})});return {rows,collection,runTransaction:fn=>{const result=queue.then(()=>fn({get:async ref=>({exists:rows.has(ref.key),data:()=>rows.get(ref.key)}),set:(ref,value)=>rows.set(ref.key,value)}));queue=result.catch(()=>{});return result;}};}
const session='11111111-1111-4111-8111-111111111111';
test('interest collection requires separate explicit statistics consent, valid origin and browser privacy',()=>{
 const req={headers:{origin:'https://www.fiosperfeitos.com.br'},body:{measurement:{consent:true,session}}};assert.equal(mayMeasure(req),true);
 for(const update of [{headers:{origin:'https://evil.test'}},{headers:{...req.headers,'sec-gpc':'1'}},{headers:{...req.headers,dnt:'1'}},{body:{measurement:{consent:false,session}}},{body:{measurement:{consent:true,session:'invalid'}}}])assert.equal(mayMeasure({...req,...update}),false);
});
test('interest dimensions contain categories and budget band only, with exact boundary checks',()=>{
 for(const [budget,band] of [[100,'up100'],[100.01,'100to200'],[200,'100to200'],[200.01,'200to400'],[400,'200to400'],[400.01,'over400']])assert.equal(dimensions({...input,budget}).budgetBand,band);
 assert.deepEqual(Object.keys(dimensions({...input,email:'secret',phone:'private'})),['hair','chemistry','goal','budgetBand']);
 for(const update of [{hair:'unknown'},{goal:'__proto__'},{budget:0},{budget:Infinity}])assert.equal(dimensions({...input,...update}),null);
});
test('concurrent duplicate queries count once; changed profiles and new sessions count separately',async()=>{
 const db=fakeDb(),now=Date.parse('2026-10-23T12:00:00Z'),result={products:[{},{},{}]};
 const replies=await Promise.all([recordInterest(db,input,result,session,now),recordInterest(db,input,result,session,now)]);assert.deepEqual(replies.sort(),[false,true]);
 await recordInterest(db,input,{products:[]},'22222222-2222-4222-8222-222222222222',now);
 const row=[...db.rows.entries()].find(([k])=>k.startsWith('careInterestStats/'))[1];assert.equal(row.queries,2);assert.equal(row.complete,1);assert.equal(row.none,1);
 const receipt=[...db.rows.entries()].find(([k])=>k.startsWith('careInterestReceipts/'))[1];assert.deepEqual(Object.keys(receipt),['expiresAt']);
 const stored=JSON.stringify([...db.rows]);for(const value of [session,'150','email','phone','budget"'])assert.ok(!stored.includes(value));
 await recordInterest(db,{...input,goal:'frizz'},result,session,now);assert.equal([...db.rows.keys()].filter(k=>k.startsWith('careInterestStats/')).length,2);
});
test('report dates respect São Paulo, reject invalid/inverted/oversized periods and combine all filters',()=>{
 assert.equal(dayKey(Date.parse('2026-10-23T01:30:00Z')),'2026-10-22');
 for(const query of [{from:'2026-02-30',to:'2026-03-01'},{from:'2026-10-24',to:'2026-10-23'},{from:'2026-01-01',to:'2026-10-23'},{hair:'<script>'}])assert.throws(()=>reportFilters(query));
 const filters=reportFilters({from:'2026-10-01',to:'2026-10-23',hair:'curly',chemistry:'treated',goal:'hydration',budgetBand:'100to200'});
 const base={day:'2026-10-23',...dimensions(input),queries:4,complete:2,partial:1,none:1};
 const report=summarize([base,{...base,hair:'straight'},{...base,day:'2026-09-30'}],filters);assert.equal(report.queries,4);assert.equal(report.profiles.length,1);assert.equal(report.none,1);
});
test('only admins can read interests and malformed dates never query Firestore',async()=>{
 let reads=0;const handler=report(()=>{reads++;return fakeDb();});
 for(const role of [undefined,'influencer','collaborator']){let code;await handler({admin:{role},query:{}},{status:v=>{code=v;return {json(){}};}});assert.equal(code,403);}
 let code;await handler({admin:{role:'admin'},query:{from:'bad'}},{status:v=>{code=v;return {json(){}};}});assert.equal(code,400);assert.equal(reads,0);
});
test('public recommendation route keeps service available if optional reporting fails',async()=>{
 const express=require('express'),{createRouter}=require('./discovery'),db={collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({enabled:true,rules:[]})})})}),runTransaction:async()=>{throw Error('statistics offline');}};
 const app=express();app.use(express.json());app.use(createRouter({getDb:()=>db,getCatalog:async()=>[]}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/ritual',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.fiosperfeitos.com.br'},body:JSON.stringify({...input,measurement:{consent:true,session}})});assert.equal(r.status,200);assert.deepEqual((await r.json()).data.products,[]);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
const controllerModule=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(require('node:path').join(__dirname,'../../..','js/care-query-controller.js'),'utf8')).toString('base64'));
test('automatic query ignores stale replies, cancels old requests and keeps newest products',async()=>{
 const {createCareQueryController}=await controllerModule,requests=[],received=[];
 const controller=createCareQueryController({request:(input,signal)=>new Promise(resolve=>requests.push({input,signal,resolve})),start(){},result:value=>received.push(value),error:()=>assert.fail('unexpected error'),finish(){}});
 const a=controller.query({goal:'hydration'});controller.invalidate();const b=controller.query({goal:'frizz'});
 assert.equal(requests[0].signal.aborted,true);requests[1].resolve({products:['new']});await b;requests[0].resolve({products:['old']});await a;assert.deepEqual(received,[{products:['new']}]);
 await controller.query({goal:'frizz'});assert.equal(requests.length,2);
});
test('query errors allow retry and invalidation suppresses stale errors',async()=>{
 const {createCareQueryController}=await controllerModule;let reject,finished=0,errors=0;
 const controller=createCareQueryController({request:()=>new Promise((_,r)=>{reject=r;}),start(){},result(){},error(){errors++;},finish(){finished++;}});
 const pending=controller.query({});controller.invalidate();reject(Error('stale'));await pending;assert.equal(errors,0);
 const current=controller.query({});reject(Error('current'));await current;assert.equal(errors,1);assert.equal(finished,1);
});

test('old visit consent alone does not authorize care interest collection',async()=>{
 const vm=require('node:vm'),path=require('node:path'),policy=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../../../js/analytics/analytics-policy.js'),'utf8')).toString('base64'));
 const values=new Map([['fp-analytics-consent-v1',JSON.stringify({value:'granted',savedAt:Date.now()})]]);
 const sandbox={readConsent:policy.readConsent,localStorage:{getItem:key=>values.get(key)}};vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../../js/analytics/care-consent.js'),'utf8').replace(/^import .*;/gm,'').replace(/export /g,''),sandbox);
 assert.equal(sandbox.careConsent(),null);values.set('fp-care-interests-consent-v1',JSON.stringify({value:'granted',savedAt:Date.now()}));assert.equal(sandbox.careConsent(),'granted');
});
test('recommendation HTTP requests without consent never write; consented requests only update aggregate fields',async()=>{
 const express=require('express'),{createRouter}=require('./discovery'),db=fakeDb();db.rows.set('storeRitualRules/current',{enabled:true,rules:[]});
 const app=express();app.use(express.json());app.use(createRouter({getDb:()=>db,getCatalog:async()=>[]}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const request=body=>fetch('http://127.0.0.1:'+server.address().port+'/ritual',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.fiosperfeitos.com.br'},body:JSON.stringify(body)});
 try{
  assert.equal((await request(input)).status,200);assert.equal(db.rows.size,1);
  assert.equal((await request({...input,measurement:{consent:true,session},email:'secret@example.test'})).status,200);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal([...db.rows.keys()].filter(k=>k.startsWith('careInterestStats/')).length,1);assert.ok(!JSON.stringify([...db.rows]).includes('secret@example.test'));
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('manual refresh rechecks current stock instead of retaining an automatic cached result',async()=>{
 const {createCareQueryController}=await controllerModule;let calls=0;const results=[];
 const controller=createCareQueryController({request:async()=>({products:++calls===1?['available']:[]}),start(){},result:data=>results.push(data),error:()=>assert.fail(),finish(){}});
 await controller.query(input);await controller.query(input);assert.equal(calls,1);
 await controller.query(input,{force:true});assert.equal(calls,2);assert.deepEqual(results.at(-1),{products:[]});
});

test('four-product complete routines are not counted as partial and matching duos remain partial',async()=>{
 const db=fakeDb(),now=Date.now();await recordInterest(db,input,{products:[{},{},{},{}],routineComplete:true},session,now);
 await recordInterest(db,input,{products:[{},{}],routineComplete:false},'22222222-2222-4222-8222-222222222222',now);
 const stats=[...db.rows.entries()].find(([k])=>k.startsWith('careInterestStats/'))[1];assert.equal(stats.complete,1);assert.equal(stats.partial,1);
});
