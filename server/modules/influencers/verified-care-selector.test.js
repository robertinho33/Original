'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {parseTable}=require('../../../js/catalog/csv-data');
const {parseMetadata}=require('../../../js/catalog/product-metadata');
const {mergePublicProducts}=require('../catalog/catalog-view');
const {recommend}=require('./ritual-recommender');
const csv=parseTable(fs.readFileSync(require('node:path').resolve(__dirname,'../../../data/catalog/sources/EcoBelle.csv'),'utf8')),headers=csv.shift();
const catalog=mergePublicProducts([],csv.map(values=>{const row=Object.fromEntries(headers.map((h,i)=>[h,values[i]]));return {...row,price:Number(row.price),stock:3,sourceId:'ecobelle',catalogProfile:parseMetadata(row)};}));
const config={enabled:true,automatic:true,rules:[]},input={hair:'wavy',chemistry:'treated',goal:'frizz',budget:490};
test('verified EcoBelle selection chooses a factual frizz kit and excludes its components',()=>{
 const result=recommend(config,catalog,input);assert.equal(result.products[0].sku,'PML3C9J4M');assert.ok(result.products.length>1);assert.ok(result.total<=490);
 assert.ok(!result.products.some(p=>['5CLM83ZE4','8YHKWEN8R','K6ND8CCHN','FCVXNP2J9','FMC93GCXT','3SSKRFEP5'].includes(p.sku)));
 for(const p of result.products)assert.ok(catalog.find(c=>c.sku===p.sku).recommendationProfile.goals.includes('frizz'));
 for(let i=2;i<result.products.length;i++)assert.ok(result.products[i-1].price>=result.products[i].price);
 assert.ok(result.products[0].matchReasons.some(r=>r.includes('não detalha')));
});
test('kits use descending price only after the confirmed purpose filter',()=>{
 assert.equal(recommend(config,catalog,{...input,goal:'nutrition',budget:490}).products[0].sku,'3SSKRFEP5');
 assert.equal(recommend(config,catalog,{...input,goal:'oiliness',budget:490}).products[0].sku,'2QSQFLXZ6');
});
test('oily roots can receive focused treatments for ends without repeating kit members',()=>{
 const base={...input,goal:'oiliness',budget:490},normal=recommend(config,catalog,{...base,ends:'normal'});
 assert.equal(normal.products.length,1);
 const signatures=[];
 for(const ends of ['dry','damaged','frizzy']){
  const result=recommend(config,catalog,{...base,ends});assert.equal(result.products[0].sku,'2QSQFLXZ6');assert.ok(result.products.length>1);assert.ok(result.total<=490);
  assert.ok(!result.products.some(p=>['THQ44H5B8','HP9LFWALK','X3DYUC6EA'].includes(p.sku)));
  for(let i=2;i<result.products.length;i++)assert.ok(result.products[i-1].price>=result.products[i].price);
  for(const p of result.products.slice(1)){const c=catalog.find(c=>c.sku===p.sku).recommendationProfile;assert.ok(['treat','finish'].includes(c.step));assert.ok(c.goals.includes(p.matchedGoal));}
  signatures.push(result.products.map(p=>p.sku).join('|'));
 }
 assert.equal(new Set(signatures).size,3);assert.throws(()=>recommend(config,catalog,{...base,ends:'invalid'}));
});
test('all profiles respect stock, visibility, budget, verified purpose and unique kit contents',()=>{
 for(const hair of ['straight','wavy','curly','coily'])for(const chemistry of ['natural','treated'])for(const goal of ['hydration','nutrition','repair','oiliness','frizz','curls','color'])for(const budget of [1,40,120,121,200,490,1000]){
  const result=recommend(config,catalog,{hair,chemistry,goal,budget});assert.ok(result.total<=budget);assert.equal(new Set(result.products.map(p=>p.sku)).size,result.products.length);
  assert.equal(Math.round(result.products.reduce((sum,p)=>sum+p.price,0)*100),Math.round(result.total*100));
  const kit=result.products.find(p=>p.step==='kit'),members=new Set(catalog.find(p=>p.sku===kit?.sku)?.recommendationProfile.components.map(c=>c.sku)||[]);
  for(const p of result.products){const original=catalog.find(c=>c.sku===p.sku),profile=original.recommendationProfile;assert.ok(profile.verified&&profile.goals.includes(p.matchedGoal));if(p.matchedGoal!==goal){assert.equal(p.step,'kit');assert.ok(result.products.some(other=>other.matchedGoal===goal));}assert.ok(!profile.restrictions.includes('blonde_only')&&!profile.restrictions.includes('light_tones_only'));assert.ok(!members.has(p.sku));if(profile.hairScope!=='unknown')assert.ok(profile.hair.includes(hair));if(profile.chemistryScope!=='unknown')assert.ok(profile.chemistry.includes(chemistry));}
 }
 const unavailable=catalog.map(p=>({...p,stock:0}));assert.deepEqual(recommend(config,unavailable,input).products,[]);
 const legacy=catalog.map(({recommendationProfile,...p})=>p);assert.deepEqual(recommend({...config,manufacturerEvidence:'ecobelle'},legacy,input).products,[]);
});
test('coily curls with dry ends receives a supporting kit first and retains a curl product',()=>{
 const result=recommend(config,catalog,{hair:'coily',chemistry:'treated',goal:'curls',ends:'dry',budget:400});
 assert.equal(result.products[0].step,'kit');assert.ok(['hydration','nutrition'].includes(result.products[0].matchedGoal));assert.ok(result.products.some(p=>p.matchedGoal==='curls'));assert.ok(result.total<=400);
 assert.ok(!result.products.some(p=>p.sku==='7TNHTQDUL'));
 for(let i=2;i<result.products.length;i++)assert.ok(result.products[i-1].price>=result.products[i].price);
});
test('an affordable kit is prioritized at exactly 120 and below, without exceeding the budget',()=>{
 const goal={...input,goal:'oiliness',ends:'normal',budget:120};assert.equal(recommend(config,catalog,goal).products[0].step,'kit');
 const lower=catalog.map(p=>p.sku==='2QSQFLXZ6'?{...p,price:99}:p);assert.equal(recommend(config,lower,{...goal,budget:100}).products[0].step,'kit');
 const noRoom=catalog.map(p=>p.recommendationProfile.type==='kit'?{...p,price:400}:p);assert.ok(!recommend(config,noRoom,{hair:'coily',chemistry:'treated',goal:'curls',ends:'dry',budget:400}).products.some(p=>p.step==='kit'));
});
test('toning asks for the actual shade and never suggests blonde-only products for grey or dark hair',()=>{
 const color={...input,goal:'color'};
 assert.equal(recommend(config,catalog,{...color,shade:'other'}).products.length,0);
 assert.ok(recommend(config,catalog,{...color,shade:'blonde'}).products.length>0);
 const grey=recommend(config,catalog,{...color,shade:'grey'});assert.ok(grey.products.length>0);
 for(const p of grey.products)assert.ok(!catalog.find(c=>c.sku===p.sku).recommendationProfile.restrictions.includes('blonde_only'));
 assert.throws(()=>recommend(config,catalog,{...color,shade:'invalid'}));
});
test('purpose evidence requires official exact-domain source and keeps unknown scopes explicit',()=>{
 const row=Object.fromEntries(headers.map((h,i)=>[h,csv.find(v=>v[0]==='LPGSTQBW8')[i]]));
 const p=parseMetadata(row);assert.equal(p.hairScope,'unknown');assert.equal(p.chemistryScope,'unknown');assert.deepEqual(p.hair,[]);
 for(const care_source of ['https://grupoecobelle.com.br.evil.example/p','http://www.grupoecobelle.com.br/a/p','https://other.example/p'])assert.throws(()=>parseMetadata({...row,care_source}));
 const publicProduct=catalog.find(p=>p.sku==='LPGSTQBW8');assert.ok(!JSON.stringify(publicProduct).includes('care_notes'));assert.equal(publicProduct.recommendationProfile.verified,true);
});
test('three comparisons preserve kits, primary purpose, budget and actual distinct product sets',()=>{
 for(const hair of ['straight','wavy','curly','coily'])for(const goal of ['hydration','nutrition','repair','frizz','curls','oiliness','color'])for(const ends of ['normal','dry','damaged','frizzy'])for(const budget of [120,400,600]){
  const answers={hair,goal,ends,budget,chemistry:'treated',...(goal==='color'?{shade:'blonde'}:{})};const result=recommend(config,catalog,answers),all=[result,...result.alternatives];assert.ok(all.length<=3);
  const signatures=[];for(const option of all){if(!option.products.length)continue;const signature=option.products.map(p=>p.sku).sort().join('|');signatures.push(signature);assert.ok(option.total<=budget);assert.equal(Math.round(option.total*100),option.products.reduce((sum,p)=>sum+Math.round(p.price*100),0));assert.equal(new Set(option.products.map(p=>p.sku)).size,option.products.length);
   if(result.products[0]?.step==='kit')assert.equal(option.products[0].step,'kit');if(result.products.some(p=>p.matchedGoal===goal))assert.ok(option.products.some(p=>p.matchedGoal===goal));
   const kit=option.products.find(p=>p.step==='kit'),members=new Set(catalog.find(p=>p.sku===kit?.sku)?.recommendationProfile.components.map(c=>c.sku)||[]);for(const p of option.products)assert.ok(!members.has(p.sku));
  }assert.equal(new Set(signatures).size,signatures.length);
 }
 const answers={hair:'coily',chemistry:'treated',goal:'curls',ends:'dry',budget:400};const result=recommend(config,catalog,answers);assert.equal(result.alternatives.length,2);assert.equal(new Set([result,...result.alternatives].map(o=>o.products[0].sku)).size,3);
 assert.deepEqual(recommend(config,[...catalog].reverse(),answers),result);
});
test('limited inventory never fabricates three copies of a sole available kit',()=>{
 const only=catalog.filter(p=>p.sku==='2QSQFLXZ6');const result=recommend(config,only,{...input,goal:'oiliness',budget:400,ends:'normal'});assert.equal(result.products.length,1);assert.deepEqual(result.alternatives,[]);
});
