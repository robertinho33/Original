'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {careLine}=require('./care-lines'),{recommend}=require('./ritual-recommender');
const config={enabled:true,automatic:true,rules:[]},input={hair:'curly',chemistry:'treated',goal:'hydration',budget:150};
const product=(sku,name,price)=>({sku,name,price,stock:3,active:true});
const shampoo=product('SH','Shampoo HidraSim Bela Pro 500 mL',28),conditioner=product('CO','Condicionador HidraSim Bela Pro 500 mL',28),mask=product('MA','Máscara HidraSim Bela Pro 300 g',36),finish=product('FI','Sérum HidraSim Bela Pro 60 mL',60);
test('shampoo and conditioner share exact line; affordable mask from that line is included before finalizer',()=>{
 const result=recommend(config,[shampoo,conditioner,mask,finish,product('OTHER','Máscara NutriSim Bela Pro 300 g',1)],input);
 assert.deepEqual(result.products.map(p=>p.sku),['SH','MA','CO']);assert.equal(result.total,92);assert.equal(result.routineComplete,true);assert.equal(result.line,'HidraSim');
 const full=recommend(config,[shampoo,conditioner,mask,finish],{...input,budget:160});assert.deepEqual(full.products.map(p=>p.step),['wash','treat','condition','finish']);assert.equal(full.total,152);assert.equal(full.routineComplete,true);
});
test('insufficient mask budget retains matching duo without spending it on an optional finalizer',()=>{
 const result=recommend(config,[shampoo,conditioner,mask,product('CHEAP-FI','Sérum HidraSim Bela Pro',5)],{...input,budget:90});
 assert.deepEqual(result.products.map(p=>p.sku),['SH','CO']);assert.equal(result.total,56);assert.equal(result.routineComplete,false);
});
test('does not substitute conditioner or mask from another line or brand',()=>{
 const wrong=product('WRONG','Condicionador NutriSim Bela Pro 500 mL',10),wrongBrand=product('BRAND','Condicionador HidraSim EcoBelle 500 mL',10);
 for(const candidate of [wrong,wrongBrand]){const result=recommend(config,[shampoo,candidate,mask],input);assert.ok(!(result.products.some(p=>p.sku==='SH')&&result.products.some(p=>p.step==='condition')));assert.equal(result.products.length,1);}
 const noMask=recommend(config,[shampoo,conditioner,product('OTHER','Máscara NutriSim Bela Pro',5)],input);assert.deepEqual(noMask.products.map(p=>p.sku),['SH','CO']);
});
test('generic brand names do not establish a line and unknown products do not form a routine',()=>{
 assert.equal(careLine({name:'Shampoo',sourceName:'Marca'}),null);assert.equal(careLine({name:'Máscara Hidratante',sourceName:'Marca'}),null);
 const result=recommend(config,[product('A','Shampoo',10),product('B','Condicionador',10),product('C','Máscara',10)],input);assert.equal(result.products.length,1);assert.ok(!JSON.stringify(result).includes('undefined'));assert.equal(result.routineComplete,false);
});
test('line matching handles accents and volumes while keeping La Boue color variants separate',()=>{
 const names=['Shampoo Coco & Camomila by Vitória Lima EcoBelle - 300 mL','Condicionador Coco & Camomila by Vitória Lima EcoBelle 300 mL','Máscara Coco & Camomila by Vitória Lima EcoBelle 250g'];
 assert.equal(new Set(names.map(name=>careLine({name}).key)).size,1);
 assert.notEqual(careLine({name:'Shampoo La Boue Home Care Verte EcoBelle'}).key,careLine({name:'Condicionador La Boue Home Care Blanc EcoBelle'}).key);
});
test('stock and affordability are checked for every component, including optional mask',()=>{
 const result=recommend(config,[shampoo,conditioner,{...mask,stock:0},finish],{...input,budget:60});assert.equal(result.products.length,2);assert.ok(result.total<=60);
 const small=recommend(config,[shampoo,conditioner,mask],{...input,budget:40});assert.equal(small.products.length,1);assert.equal(small.products[0].sku,'MA');
});
test('line selection is deterministic when catalog order changes',()=>{
 const rows=[shampoo,conditioner,mask,finish,product('SMALL-SH','Shampoo HidraSim Bela Pro 250 mL',20)];assert.deepEqual(recommend(config,rows,input),recommend(config,[...rows].reverse(),input));
});

test('reviewed restricted products remain available without automatically treating a kit as a single shampoo',()=>{
 const kit=product('KIT','Kit doÈden Capim-Limão e Alecrim EcoBelle',90);
 const rules=[{sku:'KIT',goal:'hydration',step:'wash',hair:'all',chemistry:'all',reason:'Seleção revisada pela equipe.'}];
 const selected=recommend({...config,rules},[kit],input);assert.equal(selected.products.length,1);assert.equal(selected.products[0].selectionSource,'curated');assert.equal(selected.routineComplete,false);
});
