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
