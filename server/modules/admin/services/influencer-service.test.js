'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {saveInfluencer}=require('./influencer-service');
const {filterInfluencers,duplicateIds}=require('../../../../js/influencer-identity');
function database(seed=[]){
 const records=new Map(seed.map(row=>['influencers/'+row.id,{...row}]));let serial=Promise.resolve(),id=0;
 const ref=(collection,key)=>({id:key,key:collection+'/'+key});
 const db={collection:name=>({name,doc:key=>ref(name,key||'new-'+(++id))}),runTransaction:fn=>{
  const pending=serial.then(async()=>{
   const draft=structuredClone(records);let writes=false,locked=false;
   const tx={get:async target=>{
    assert.equal(writes,false,'all transaction reads precede writes');
    if(target.key==='settings/influencer-write-lock')locked=true;
    if(target.name){assert.ok(locked,'shared lock read before duplicate query');return {docs:[...draft].filter(([key])=>key.startsWith(target.name+'/')).map(([key,value])=>({id:key.split('/')[1],data:()=>({...value})}))};}
    return {exists:draft.has(target.key),data:()=>draft.get(target.key)};
   },set:(target,value)=>{writes=true;draft.set(target.key,{...value});},update:(target,value)=>{writes=true;draft.set(target.key,{...draft.get(target.key),...value});}};
   const result=await fn(tx);records.clear();for(const [key,value]of draft)records.set(key,value);return result;
  });serial=pending.catch(()=>{});return pending;
 }};return {db,records};
}
const person={name:'Marcos Doces',email:'marcos@example.test',phone:'(11) 96690-3241',commissionDefault:20,active:true};
test('creation rejects normalized email or same name and phone, even with simultaneous saves',async()=>{
 const {db,records}=database();
 const results=await Promise.allSettled([saveInfluencer(db,null,person),saveInfluencer(db,null,{...person,email:' MARCOS@EXAMPLE.TEST ',phone:'+55 11 96690 3241'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.equal([...records.keys()].filter(k=>k.startsWith('influencers/')).length,1);
 await assert.rejects(saveInfluencer(db,null,{...person,email:'other@example.test',name:'  marcos   doces ',phone:'11966903241'}),/Já existe/);
 // A shared phone alone is not enough to identify the same person.
 assert.ok((await saveInfluencer(db,null,{...person,name:'Outra Pessoa',email:'other@example.test'})).id);
});
test('editing preserves commission and metadata; existing duplicate can be maintained without creating a new conflict',async()=>{
 const {db,records}=database([{...person,id:'one',portalEnabled:true,privateMetadata:'keep'},{...person,id:'two'},{name:'Outro',email:'other@example.test',id:'three'}]);
 const updated=await saveInfluencer(db,'one',{pixKey:'novo-pix',commissionDefault:15});
 assert.equal(updated.commissionDefault,15);assert.equal(updated.portalEnabled,true);assert.equal(records.get('influencers/one').privateMetadata,'keep');
 await assert.rejects(saveInfluencer(db,'one',{email:'other@example.test'}),/Já existe/);
 await assert.rejects(saveInfluencer(db,'missing',person),/não encontrado/);
 assert.equal(records.get('influencers/one').email,person.email);
});
test('search filters accents, email, unformatted phone, status, portal access and legacy duplicates',()=>{
 const rows=[{...person,id:'one',name:'Márcos Doces',portalEnabled:true},{...person,id:'two',active:false},{id:'three',name:'Adriana',email:'a@example.test',phone:'11900000000',pixKey:'PIX-ABC',active:true}];
 assert.deepEqual(filterInfluencers(rows,{query:'marcos doces',status:'active',access:'enabled'}).map(r=>r.id),['one']);
 assert.equal(filterInfluencers(rows,{query:'11966903241'}).length,2);
 assert.equal(filterInfluencers(rows,{query:'a@example.test'}).length,1);
 assert.equal(filterInfluencers(rows,{query:'pix-abc'}).length,1);
 assert.equal(filterInfluencers(rows,{status:'inactive'}).length,1);
 assert.equal(filterInfluencers(rows,{access:'disabled'}).length,2);
 assert.deepEqual([...duplicateIds(rows)],['one','two']);
 assert.equal(filterInfluencers(rows,{duplicates:true}).length,2);
 assert.equal(filterInfluencers(rows,{query:'nada'}).length,0);
});
