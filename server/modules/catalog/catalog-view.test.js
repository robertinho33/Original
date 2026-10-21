'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {enrichProducts,mergePublicProducts}=require('./catalog-view');
const raw=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../data/catalog/catalog-runtime.json'),'utf8').replace(/^\uFEFF/,''));
const base=Array.isArray(raw)?raw:raw.products;
test('legacy products without source fields recover the original catalog brand by SKU',()=>{
  const legacy=base.map((p,i)=>({id:'doc-'+i,sku:p.sku,name:p.name,price:123.45,stock:7,...(p.sourceId==='truss'?{sourceId:p.sourceId,sourceName:p.sourceName}:{})}));
  const rows=enrichProducts(legacy,base);assert.equal(rows.length,base.length);
  assert.deepEqual([...new Set(rows.map(p=>p.sourceId))].sort(),['brae','ecobelle','inovax','truss']);
  for(let i=0;i<rows.length;i++){assert.equal(rows[i].id,legacy[i].id);assert.equal(rows[i].price,123.45);assert.equal(rows[i].stock,7);assert.ok(rows[i].sourceName);}
  assert.equal(enrichProducts([{id:'custom',sku:'UNKNOWN',name:'Sem origem',price:10}],base)[0].sourceName,'');
});
test('public catalog uses current prices and visibility without exposing administrative metadata',()=>{
  const original=base[0],current={id:'PRIVATE-DOC',sku:original.sku,name:'Nome editado',price:29.9,stock:4,active:false,updatedBy:'PRIVATE-EMAIL',internalNote:'PRIVATE-NOTE'};
  const result=mergePublicProducts([original],[current])[0];
  assert.equal(result.name,'Nome editado');assert.equal(result.price,29.9);assert.equal(result.stock,4);assert.equal(result.active,false);assert.equal(result.sourceId,original.sourceId);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

