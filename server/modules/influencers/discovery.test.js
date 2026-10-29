'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {normalizeRules,recommend,normalizeStore,projectStore,storePublication,createRouter,admin}=require('./discovery');
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

test('store publication diagnosis never presents drafts or broken links as published',()=>{
  const config={enabled:true,name:'Vitrine',skus:['SH'],coupon:'PARCEIRO'},person={active:true};
  assert.equal(storePublication(config,person,'PARCEIRO').published,true);
  for(const state of [storePublication({},person,'',false),storePublication({...config,enabled:false},person,'PARCEIRO'),storePublication(config,{active:false},'PARCEIRO'),storePublication(config,undefined,'PARCEIRO'),storePublication(config,person,''),storePublication({...config,skus:[]},person,'PARCEIRO')]){
    assert.equal(state.published,false);assert.ok(state.issues.length>0);
  }
});
test('public HTTP stores protect private data; questionnaire requires kits even with legacy manual rules',async()=>{
  const records={'influencers/demo':{active:true,email:'PRIVATE',phone:'SECRET'},'influencerPublicStores/demo':{enabled:true,name:'Nome público',coupon:'PARCEIRO',skus:['SH'],passwordHash:'PRIVATE'},'storeRitualRules/current':rules};
  const db={collection:name=>({doc:id=>({get:async()=>({exists:!!records[name+'/'+id],data:()=>records[name+'/'+id]})}),get:async()=>({docs:[{data:()=>({code:'PARCEIRO',influencerId:'demo',active:true})}]})})};
  let servedCatalog=catalog;
  const app=express();app.use(express.json());app.use(createRouter({getDb:()=>db,getCatalog:async()=>servedCatalog}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    let response=await fetch(base+'/stores/demo'),data=await response.json();assert.equal(response.status,200);assert.equal(data.data.name,'Nome público');assert.ok(!JSON.stringify(data).includes('PRIVATE'));assert.ok(!JSON.stringify(data).includes('SECRET'));
    records['influencers/demo'].active=false;assert.equal((await fetch(base+'/stores/demo')).status,404);records['influencers/demo'].active=true;
    records['influencerPublicStores/demo'].enabled=false;assert.equal((await fetch(base+'/stores/demo')).status,404);
    response=await fetch(base+'/ritual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});data=await response.json();assert.deepEqual(data.data.products,[]);assert.match(data.data.message,/kit/);
    servedCatalog=[...catalog,{sku:'KIT',name:'Kit completo',price:100,stock:2,sourceId:'ecobelle',recommendationProfile:{verified:true,type:'kit',step:'kit',goals:['hydration'],primaryGoal:'hydration',hairScope:'unknown',chemistryScope:'unknown',restrictions:[],components:catalog.map(p=>({sku:p.sku,quantity:1,name:p.name}))}}];
    response=await fetch(base+'/ritual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});data=await response.json();assert.equal(data.data.products[0].step,'kit');assert.equal(data.data.total,100);assert.equal(data.data.products.length,1);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('only administrators can configure storefronts and ritual recommendations',async()=>{
  for(const kind of ['store','ritual'])for(const write of [false,true])for(const role of ['collaborator','influencer',undefined]){
    let status;await admin(kind,write)({admin:role?{role}:null},{status(code){status=code;return this;},json(){}});assert.equal(status,403);
  }
});

test('ritual prioritizes specific reviewed profiles over cheaper generic products for the same stages',()=>{
  const extra={sku:'SPECIFIC',name:'Tratamento específico',price:60,stock:1,active:true};
  const config={enabled:true,rules:[...rules.rules,{sku:extra.sku,step:'treat',goal:'hydration',hair:'curly',chemistry:'treated',reason:'Motivo aprovado para este perfil.'}]};
  const result=recommend(config,[...catalog,extra],{...input,budget:110});
  assert.equal(result.total,110);assert.equal(result.products.length,3);
  const treatment=result.products.find(p=>p.step==='treat');
  assert.equal(treatment.sku,'SPECIFIC');assert.equal(treatment.reason,'Motivo aprovado para este perfil.');
  assert.ok(treatment.matchReasons.some(reason=>reason.includes('cacheados')));
  assert.ok(treatment.matchReasons.some(reason=>reason.includes('química ou coloração')));
  assert.equal(recommend(config,[...catalog,extra],input).products.find(p=>p.step==='treat').sku,'MA');
});

test('ritual evaluates combinations instead of letting the first cheap selection block other stages',()=>{
  const items=[{sku:'BOTH',name:'Multi',price:20,stock:1},{sku:'TREAT',name:'Tratamento',price:25,stock:1},{sku:'FIN',name:'Finalizador',price:10,stock:1}];
  const row=(sku,step)=>({sku,step,goal:'hydration',hair:'all',chemistry:'all',reason:'Revisado.'});
  const config={enabled:true,rules:[row('BOTH','treat'),row('BOTH','wash'),row('TREAT','treat'),row('FIN','finish')]};
  const result=recommend(config,items,{...input,budget:55});
  assert.equal(result.products.length,3);assert.equal(result.total,55);
  assert.equal(result.products.find(p=>p.step==='treat').sku,'TREAT');
  assert.equal(new Set(result.products.map(p=>p.sku)).size,3);
});

test('ritual uses cheapest total as a tie-breaker, preserves treatment priority and is stable across row order',()=>{
  const alt={sku:'OTHER',name:'Outra máscara',price:55,stock:1};
  const config={enabled:true,rules:[...rules.rules,{...rules.rules[1],sku:'OTHER'}]};
  const first=recommend(config,[...catalog,alt],{...input,budget:150});
  assert.equal(first.total,100);assert.equal(first.products.find(p=>p.step==='treat').sku,'MA');
  assert.deepEqual(recommend({...config,rules:[...config.rules].reverse()},[alt,...catalog],{...input,budget:150}),first);
  assert.equal(recommend(config,[...catalog,alt],{...input,budget:50}).products[0].sku,'MA');
});

test('ritual rejects malformed input, unavailable stock and unreviewed products; amounts stay within cents',()=>{
  for(const value of [null,[],{...input,goal:['hydration']},{...input,budget:true},{...input,budget:.5}])assert.throws(()=>recommend(rules,catalog,value));
  const noStock=catalog.map(p=>({...p,stock:Infinity}));assert.equal(recommend(rules,noStock,input).products.length,0);
  const precise=catalog.map((p,i)=>({...p,price:[10,20,10.01][i]}));
  const result=recommend(rules,[...precise,{sku:'UNREVIEWED',price:1,stock:100}],{...input,budget:40.01});
  assert.equal(result.total,40.01);assert.equal(result.products.length,3);assert.ok(!result.products.some(p=>p.sku==='UNREVIEWED'));
  assert.ok(result.products.every(p=>!('stock' in p)&&!('specificity' in p)));
});
