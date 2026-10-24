'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {recommend}=require('./ritual-recommender'),{classify,automaticCandidates}=require('./catalog-care-candidates');
const input={hair:'curly',chemistry:'treated',goal:'hydration',budget:150},config={enabled:true,automatic:true,rules:[]};
const catalog=[{sku:'SH',name:'Shampoo HidraSim',category:'Bela Pro',price:28,stock:2},{sku:'MA',name:'Máscara Hidratante',price:40,stock:2},{sku:'FI',name:'Creme de Pentear Cachos',price:28,stock:2}];
test('catalog algorithm builds three categories within budget without saved indications',()=>{
 const value=recommend(config,catalog,input);assert.equal(value.products.length,3);assert.equal(value.total,96);assert.deepEqual(value.products.map(p=>p.step),['wash','treat','finish']);
 assert.ok(value.products.every(p=>p.selectionSource==='catalog'));assert.ok(value.products.every(p=>p.matchReasons.some(reason=>reason.includes('química')||reason.includes('quimica'))));
 assert.equal(recommend(config,catalog,{...input,budget:40}).products[0].step,'treat');
 assert.equal(recommend(config,catalog,{...input,budget:20}).products.length,0);
});
test('off switch and curated-only mode remain available and catalog respects stock, active and price',()=>{
 assert.equal(recommend({...config,automatic:false},catalog,input).products.length,0);
 assert.equal(recommend({...config,enabled:false},catalog,input).products.length,0);
 const blocked=catalog.map(p=>({...p,stock:0}));assert.equal(recommend(config,blocked,input).products.length,0);
 assert.equal(recommend(config,catalog.map(p=>({...p,active:false})),input).products.length,0);
 assert.equal(recommend(config,catalog.map(p=>({...p,price:NaN})),input).products.length,0);
});
test('ambiguous kits, skincare and chemical or color-changing products require curation',()=>{
 for(const name of ['Kit Shampoo e Máscara','Máscara Progressiva','Máscara Matizadora Silver','Shampoo Matizador','Selante Capilar','Oxidante OX20','Pó Descolorante','Sérum Facial','Máscara Ironed Hair','Shampoo EcoBarber'])assert.equal(classify({name,category:'EcoBelle'},input),null,name);
 assert.equal(classify({name:'Shampoo',category:'EcoBelle Skin'},input),null);
});
test('explicit hair and chemistry constraints are respected without inventing missing compatibility',()=>{
 assert.equal(classify({name:'Shampoo Liso Mágico'},input),null);
 assert.equal(classify({name:'Shampoo Cachos'},{...input,hair:'straight'}),null);
 assert.equal(classify({name:'Shampoo',description:'Para cabelos quimicamente tratados'},{...input,chemistry:'natural'}),null);
 const generic=classify({name:'Shampoo'},input);assert.ok(generic.evidence.some(r=>r.includes('conferir se atende')));assert.ok(generic.evidence.some(r=>r.includes('rótulo')));
});
test('reviewed indications win among selections with the same number of stages',()=>{
 const reviewed={sku:'REVIEWED',name:'Máscara revisada',price:60,stock:1};
 const rules=[{sku:'REVIEWED',step:'treat',goal:'hydration',hair:'curly',chemistry:'treated',reason:'Indicação revisada.'}];
 const result=recommend({...config,rules},[...catalog,reviewed],input);
 assert.equal(result.products.find(p=>p.step==='treat').sku,'REVIEWED');assert.equal(result.products.find(p=>p.step==='treat').selectionSource,'curated');
 const incompatible=rules.map(r=>({...r,hair:'straight'}));assert.ok(!recommend({...config,rules:incompatible},[...catalog,reviewed],input).products.some(p=>p.sku==='REVIEWED'));
});
test('goal keywords rank relevant catalog items above generic alternatives within the budget',()=>{
 const specific={sku:'HYDRA',name:'Máscara Hidratação e maciez',price:70,stock:1};
 const generic={...catalog[1],name:'Máscara genérica',price:30};
 const result=recommend(config,[catalog[0],generic,catalog[2],specific],input);
 assert.equal(result.products.find(p=>p.step==='treat').sku,'HYDRA');assert.ok(result.total<=input.budget);
});
test('large catalogs keep search bounded, retain low-cost choices and remain deterministic',()=>{
 const large=Array.from({length:1000},(_,i)=>({sku:'SKU-'+String(i).padStart(4,'0'),name:['Shampoo Hidratante','Máscara Hidratante','Finalizador Cachos'][i%3],price:10+i/100,stock:1}));
 const available=new Map(large.map(p=>[p.sku,{product:p,cents:Math.round(p.price*100)}]));assert.ok(automaticCandidates(available,config,input).length<=96);
 const first=recommend(config,large,input),second=recommend(config,[...large].reverse(),input);assert.deepEqual(first,second);assert.ok(first.total<=input.budget);assert.equal(new Set(first.products.map(p=>p.sku)).size,first.products.length);
});
test('automatic fallback setting is retained by admin normalization',()=>{
 const {normalizeRules}=require('./discovery');assert.equal(normalizeRules({...config,rules:[]}).automatic,true);assert.equal(normalizeRules({enabled:true,rules:[]}).automatic,false);
});
