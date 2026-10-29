'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {serializeTable}=require('../../../js/catalog/csv-data');
const {columns}=require('../../../js/catalog/product-metadata');
let database,writes=[];
const inject=(modulePath,exports)=>{const file=require.resolve(modulePath);require.cache[file]={id:file,filename:file,loaded:true,exports};};
inject('../../infrastructure/firebase/firebase-admin',{getFirestore:()=>database});
inject('./catalog-visibility-service',{getVisibility:async()=>({sources:[{id:'ecobelle',name:'EcoBelle',enabled:true}]})});
inject('./catalog-storefront-service',{invalidate(){}});
const {parseCsv,importSupplierCatalog}=require('./supplier-service');
function prepare(existing=[]){writes=[];database={collection(){return {async get(){return {docs:existing.map((data,i)=>({id:'doc'+i,data:()=>data}))};},doc(id){return {id};},async add(){}};},batch(){return {set(reference,data,options){writes.push({reference,data,options});},async commit(){}};}};}
const headers=['sku','name','weight','price','category','stock','description','image',...columns];
const csv=rows=>serializeTable([headers,...rows.map(row=>headers.map(h=>row[h]||''))]);
const base={sku:'A',name:'Máscara Linha Azul',price:'40.00',stock:'3',source_id:'ecobelle',brand:'Marca',line:'Linha Azul',product_category:'cuidados-capilares',product_subcategory:'mascaras-e-tratamentos',product_type:'individual',care_step:'treat',hair_scope:'selected',hair_types:'wavy',chemistry_scope:'selected',chemistry_types:'treated',care_goals:'frizz',primary_goal:'frizz',care_review_status:'pending',care_source:'CSV de revisão'};
test('supplier parser keeps the product line distinct from CSV line number and accepts multiline text',()=>{
 const row=parseCsv(csv([{...base,description:'Primeiro; trecho\nSegundo "trecho"'}]))[0];assert.equal(row.line,'Linha Azul');assert.equal(row.__line,2);assert.equal(row.description,'Primeiro; trecho\nSegundo "trecho"');
 const old=parseCsv('sku;name;price\n001;Produto;12.90')[0];assert.equal(old.sku,'001');assert.equal(Object.hasOwn(old,'care_review_status'),false);
});
test('supplier import stores pending metadata without replacing existing care profile',async()=>{
 prepare([{sku:'A',sourceId:'ecobelle',careProfile:{hair:['straight']}}]);await importSupplierCatalog('ecobelle',csv([base]),'admin');assert.equal(writes.length,1);assert.equal(writes[0].data.catalogProfile.line,'Linha Azul');assert.equal(writes[0].data.careProfile,undefined);assert.deepEqual(writes[0].options,{merge:true});
});
test('approved metadata updates care profile and approved compositions are validated before writes',async()=>{
 prepare();await importSupplierCatalog('ecobelle',csv([{...base,care_review_status:'approved'}]),'admin');assert.deepEqual(writes[0].data.careProfile,{hair:['wavy'],chemistry:['treated'],goals:['frizz']});
 prepare();await assert.rejects(importSupplierCatalog('ecobelle',csv([{...base,product_type:'kit',care_step:'kit',kit_review_status:'approved',kit_components:'MISSING:1'}]),'admin'),/não encontrado/);assert.equal(writes.length,0);
 prepare();await assert.rejects(importSupplierCatalog('ecobelle',csv([{...base,hair_types:'invalid'}]),'admin'),/hair_types/);assert.equal(writes.length,0);
});
