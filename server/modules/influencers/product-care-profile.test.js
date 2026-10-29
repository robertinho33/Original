'use strict';

require('node:test')('manufacturer profiles replace stale universal tags without treating unknown as all',()=>{
 const assert=require('node:assert/strict'),{forProduct,status}=require('../../../js/product-care-profile');
 const stale={hair:['straight','wavy','curly','coily'],chemistry:['natural','treated'],goals:['hydration','repair','frizz','curls','color']};
 const ox={careProfile:stale,catalogProfile:{reviewStatus:'excluded',usage:'professional'}};assert.deepEqual(forProduct(ox),{hair:[],chemistry:[],goals:[]});assert.equal(status(ox),'Fora da seleção capilar');
 assert.deepEqual(forProduct({catalogProfile:{reviewStatus:'excluded',evidenceStatus:'purpose_verified',goals:['repair']}}),{hair:[],chemistry:[],goals:[]});
 assert.deepEqual(forProduct({careProfile:stale,catalogProfile:{reviewStatus:'pending'}}),{hair:[],chemistry:[],goals:[]});
 const reviewed={careProfile:stale,catalogProfile:{reviewStatus:'approved',hair:[],chemistry:[],goals:['oiliness']}};assert.deepEqual(forProduct(reviewed),{hair:[],chemistry:[],goals:['oiliness']});
});
const test=require('node:test'),assert=require('node:assert/strict');
const {normalize,matches}=require('../../../js/product-care-profile');
const {classify}=require('./catalog-care-candidates');
const {mergePublicProducts}=require('../catalog/catalog-view');
const input={hair:'curly',chemistry:'treated',goal:'hydration',budget:150};
test('care metadata accepts multiple choices and discards unsupported or malformed input',()=>{assert.deepEqual(normalize({hair:['curly','coily','curly','invalid'],chemistry:'all',goals:['hydration','repair',{}],secret:'x'}),{hair:['curly','coily'],chemistry:[],goals:['hydration','repair']});});
test('legacy products remain eligible; explicit constraints are enforced',()=>{assert.equal(matches(null,input),true);for(const profile of [{hair:['straight']},{chemistry:['natural']},{goals:['color']}])assert.equal(matches(profile,input),false);assert.equal(matches({hair:['curly','coily'],chemistry:['natural','treated'],goals:['repair','hydration']},input),true);});
test('generic products use declared goals and hair rather than missing name keywords',()=>{const p={name:'Shampoo Linha Essencial',careProfile:{hair:['curly','coily'],chemistry:['treated','natural'],goals:['hydration','repair']}};assert.ok(classify(p,input).score>=6);assert.equal(classify(p,{...input,goal:'color'}),null);});
test('public catalog projects only normalized classification values',()=>{const p=mergePublicProducts([],[{sku:'X',name:'Shampoo',careProfile:{hair:['curly'],goals:['hydration'],chemistry:['treated'],private:'secret'},password:'hidden'}])[0];assert.deepEqual(p.careProfile,{hair:['curly'],chemistry:['treated'],goals:['hydration']});assert.equal(JSON.stringify(p).includes('secret'),false);assert.equal(p.password,undefined);});
test('reviewed rules cannot bypass explicit product exclusions',()=>{const {recommendByLine}=require('./line-care-selector');const p={sku:'X',name:'Máscara HidraSim',price:30,careProfile:{hair:['straight']}};const result=recommendByLine(new Map([['x',{product:p,cents:3000}]]),{rules:[{sku:'X',goal:'hydration',hair:'all',chemistry:'all',step:'treat',reason:'test'}]},input);assert.equal(result.products.length,0);});

test('admin search finds classification labels and completion filters preserve legacy products',async()=>{const {catalogRows,filterCatalog}=await import('../../../js/admin/modules/workspace-data.js');const rows=catalogRows([{sku:'A',name:'Genérico',careProfile:{hair:['curly'],chemistry:['treated','natural'],goals:['hydration','repair']}},{sku:'B',name:'Legado'}]);assert.equal(filterCatalog(rows,{query:'cacheado hidratação'})[0].sku,'A');assert.equal(filterCatalog(rows,{care:'complete'}).length,1);assert.equal(filterCatalog(rows,{care:'pending'})[0].sku,'B');});
test('product normalization preserves and clears classifications without altering pricing',async()=>{const {normalizeProduct}=await import('../../../js/admin/product-model.js');const p={sku:'a',name:'Shampoo',price:25,careProfile:{hair:['curly','coily'],chemistry:['treated'],goals:['hydration']}};assert.deepEqual(normalizeProduct(p).careProfile,p.careProfile);assert.equal(normalizeProduct(p).price,25);assert.deepEqual(normalizeProduct({...p,careProfile:{}}).careProfile,{hair:[],chemistry:[],goals:[]});});
