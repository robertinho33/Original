'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {normalizeRules,recommend,normalizeStore,projectStore,createRouter,admin}=require('./discovery');
const catalog=[{sku:'SH',name:'Shampoo',price:30,stock:2,active:true},{sku:'MA',name:'Máscara',price:50,stock:2,active:true},{sku:'LE',name:'Finalizador',price:20,stock:2,active:true}];
const rules=normalizeRules({enabled:true,rules:['wash','treat','finish'].map((step,i)=>({sku:catalog[i].sku,step,goal:'hydration',hair:'all',chemistry:'all',reason:'Indicação revisada pela loja.'}))});
const input={goal:'hydration',hair:'curly',chemistry:'treated',budget:100};
test('ritual respects budget, one product per step, availability and matching profile',()=>{
  const complete=recommend(rules,catalog,input);assert.equal(complete.total,100);assert.equal(complete.products.length,3);assert.equal(complete.products[0].step,'wash');
  const partial=recommend(rules,catalog,{...input,budget:50});assert.equal(partial.total,50);assert.equal(partial.products[0].sku,'MA');
  assert.equal(recommend(rules,catalog,{...input,budget:10}).products.length,0);
  assert.equal(recommend(rules,catalog.map(p=>({...p,stock:0})),input).products.length,0);
  assert.equal(recommend(rules,catalog,{...input,goal:'color'}).products.length,0);
  assert.equal(recommend({...rules,enabled:false},catalog,input).products.length,0);
  assert.equal(recommend({enabled:true,rules:rules.rules.map(r=>({...r,hair:'straight'}))},catalog,input).products.length,0);
  assert.equal(recommend({enabled:true,rules:rules.rules.map(r=>({...r,chemistry:'natural'}))},catalog,input).products.length,0);
  for(const budget of [-1,NaN,Infinity,10001])assert.throws(()=>recommend(rules,catalog,{...input,budget}));
});
test('curation rejects duplicates and store excludes private data and unsafe video links',()=>{
  assert.throws(()=>normalizeRules({rules:[rules.rules[0],rules.rules[0]]}));
  assert.throws(()=>normalizeStore({enabled:true,name:'Nome',skus:['SH'],coupon:''}));
  assert.throws(()=>normalizeStore({skus:['SH','sh']}));
  assert.throws(()=>normalizeStore({videoUrl:'https://youtube.com.evil.test/video'}));
  const store=normalizeStore({enabled:true,name:'Nome público',skus:['SH'],coupon:'PARCEIRO',email:'PRIVATE',pixKey:'SECRET'});
  const view=projectStore(store,catalog,'PARCEIRO');assert.equal(view.products.length,1);
  assert.ok(!JSON.stringify(view).includes('PRIVATE'));assert.ok(!JSON.stringify(view).includes('SECRET'));
});
test('public HTTP store checks activation and only returns public fields; ritual uses current rules',async()=>{
  const records={'influencers/demo':{active:true,email:'PRIVATE',phone:'SECRET'},'influencerPublicStores/demo':{enabled:true,name:'Nome público',coupon:'PARCEIRO',skus:['SH'],passwordHash:'PRIVATE'},'storeRitualRules/current':rules};
  const db={collection:name=>({doc:id=>({get:async()=>({exists:!!records[name+'/'+id],data:()=>records[name+'/'+id]})}),get:async()=>({docs:[{data:()=>({code:'PARCEIRO',influencerId:'demo',active:true})}]})})};
  const app=express();app.use(express.json());app.use(createRouter({getDb:()=>db,getCatalog:async()=>catalog}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    let response=await fetch(base+'/stores/demo'),data=await response.json();assert.equal(response.status,200);assert.equal(data.data.name,'Nome público');assert.ok(!JSON.stringify(data).includes('PRIVATE'));assert.ok(!JSON.stringify(data).includes('SECRET'));
    records['influencers/demo'].active=false;assert.equal((await fetch(base+'/stores/demo')).status,404);records['influencers/demo'].active=true;
    records['influencerPublicStores/demo'].enabled=false;assert.equal((await fetch(base+'/stores/demo')).status,404);
    response=await fetch(base+'/ritual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});data=await response.json();assert.equal(data.data.total,100);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('only administrators can configure storefronts and ritual recommendations',async()=>{
  for(const kind of ['store','ritual'])for(const write of [false,true])for(const role of ['collaborator','influencer',undefined]){
    let status;await admin(kind,write)({admin:role?{role}:null},{status(code){status=code;return this;},json(){}});assert.equal(status,403);
  }
});
