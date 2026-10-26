'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {recommend}=require('./ritual-recommender');
const config={enabled:true,automatic:true,rules:[]};
const input={hair:'straight',chemistry:'natural',goal:'hydration',budget:200};
const line=(label,description='',price=30,careProfile)=>['Shampoo','Condicionador','Máscara'].map((role,i)=>({sku:label+i,name:role+' '+label+' EcoBelle',description,price,stock:3,careProfile}));
const catalog=[...line('Coco & Camomila','Hidratação e maciez'),...line('HidraSim'),...line('Repair','',40,{goals:['repair']}),...line('Curlys Cachos'),...line('Liso Mágico','Controle do frizz')];
test('purpose and reviewed profiles beat incidental words and cheapest unrelated routine',()=>{
 assert.equal(recommend(config,catalog,input).line,'HidraSim');
 assert.equal(recommend(config,catalog,{...input,goal:'repair'}).products[0].sku,'Repair0');
 assert.equal(recommend(config,catalog,{...input,hair:'curly',goal:'curls'}).line,'Curlys Cachos');
 assert.equal(recommend(config,catalog,{...input,goal:'frizz'}).line,'Liso Mágico');
 assert.equal(recommend(config,catalog,{...input,goal:'color'}).products.length,0);
});
test('a relevant treatment beats a cheaper unrelated shampoo/conditioner pair',()=>{
 const products=[...line('Coco & Camomila'),{sku:'REPAIR',name:'Máscara Reconstrutora',price:50,stock:2}];
 assert.deepEqual(recommend(config,products,{...input,goal:'repair'}).products.map(p=>p.sku),['REPAIR']);
});
test('all profiles and budget boundaries obey compatibility, cents, stock and deterministic ordering',()=>{
 const runtime=require('../../../data/catalog/catalog-runtime.json').products.filter(p=>p.sourceId==='ecobelle');
 for(const hair of ['straight','wavy','curly','coily'])for(const chemistry of ['treated','natural'])for(const goal of ['hydration','repair','frizz','curls','color'])for(const budget of [1,28,55.99,80,120,200]){
  const answers={hair,chemistry,goal,budget},result=recommend(config,runtime,answers);
  assert.ok(Math.round(result.total*100)<=Math.floor(budget*100+1e-7));
  assert.equal(Math.round(result.total*100),result.products.reduce((sum,p)=>sum+Math.round(p.price*100),0));
  assert.equal(new Set(result.products.map(p=>p.sku)).size,result.products.length);
  assert.deepEqual(result,recommend(config,[...runtime].reverse(),answers));
  for(const p of result.products){assert.ok(p.matchReasons.every(r=>typeof r==='string'&&r.trim()));assert.ok(runtime.find(r=>r.sku===p.sku).stock>0);}
 }
});
test('cart merges one unit per selection, keeps previous items and filters empty descriptions',async()=>{
 const {mergeCareCart,cleanMatchReasons}=await import('../../../js/care-selection.js');
 assert.deepEqual(mergeCareCart([{sku:'A',quantity:2},{sku:' A ',quantity:1},{sku:'B',quantity:1},{sku:'BAD',quantity:-1}],[{sku:'A'},{sku:'C'}]),[{sku:'A',quantity:4},{sku:'B',quantity:1},{sku:'C',quantity:1}]);
 assert.deepEqual(cleanMatchReasons(['',null,'  ','-','Hidratação','Hidratação',false]),['Hidratação']);
});

test('published care restrictions explain the repeated line and expose compatible alternatives for the reported profile',()=>{
 const products=require('./fixtures/consultant-published.json');
 const answers={hair:'wavy',chemistry:'treated',goal:'hydration',budget:300};
 const result=recommend(config,products,answers);
 assert.equal(result.line,'Coco & Camomila');assert.equal(result.total,200);
 const alternative=result.alternatives.find(option=>option.line==='HidraSim');assert.ok(alternative);
 assert.equal(alternative.routineComplete,false);assert.equal(alternative.total,101.9);
 assert.ok(!alternative.products.some(p=>p.sku==='TJFJENBKK'),'mask explicitly excludes treated hair and hydration');
 const {matches}=require('../../../js/product-care-profile');
 for(const option of [result,...result.alternatives]){
  assert.ok(option.total<=answers.budget);
  for(const p of option.products)assert.ok(matches({...products.find(row=>row.sku===p.sku).careProfile,...(p.complementary?{goals:[]}: {})},answers));
 }
 assert.deepEqual(result,recommend(config,[...products].reverse(),answers));
 const curls=recommend(config,products,{...answers,hair:'curly',chemistry:'natural',goal:'curls'});
 assert.notEqual(curls.line,result.line);
 const lowBudget=recommend(config,products,{...answers,budget:80});
 for(const option of [lowBudget,...lowBudget.alternatives])assert.ok(option.total<=80);
});

test('curly natural hair with frizz gets a targeted routine with honestly labeled complementary stages',()=>{
 const products=require('./fixtures/consultant-published.json'),answers={hair:'curly',chemistry:'natural',goal:'frizz',budget:500};
 const result=recommend(config,products,answers);
 assert.equal(result.line,'Curlys Cachos');assert.equal(result.total,80);assert.equal(result.routineComplete,true);
 assert.deepEqual(result.products.map(p=>p.sku),['W35UTMS43','5F5NZ9HN9','Y6H5QMT4P']);
 assert.equal(result.products[0].complementary,false);
 for(const p of result.products.slice(1)){
  assert.equal(p.complementary,true);
  assert.ok(p.matchReasons.some(reason=>reason.includes('não é uma indicação específica')));
  assert.ok(!p.matchReasons.some(reason=>reason.includes('cadastrou esta opção para controle do frizz')));
 }
 assert.deepEqual(result,recommend(config,[...products].reverse(),answers));
 const restricted=products.map(p=>p.sku==='Y6H5QMT4P'?{...p,careProfile:{...p.careProfile,chemistry:['treated']}}:p);
 const excluded=recommend(config,restricted,answers);assert.ok(![excluded,...excluded.alternatives].some(option=>option.products.some(p=>p.sku==='Y6H5QMT4P')));
 const small=recommend(config,products,{...answers,budget:40});for(const option of [small,...small.alternatives])assert.ok(option.total<=40);
 // A routine consisting entirely of complements cannot satisfy another objective.
 const hydrationOnly=products.filter(p=>p.name.includes('HidraSim')).map(p=>({...p,careProfile:{hair:['curly'],chemistry:['natural'],goals:['hydration']}}));
 assert.equal(recommend(config,hydrationOnly,answers).products.length,0);
});
