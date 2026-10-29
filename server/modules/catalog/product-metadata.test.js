'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseTable,serializeTable}=require('../../../js/catalog/csv-data');
const {columns,parseMetadata,validateReferences,importPatch}=require('../../../js/catalog/product-metadata');
const approved={sku:'P',brand:'Marca',line:'Linha',product_category:'cuidados-capilares',product_subcategory:'mascaras-e-tratamentos',product_type:'individual',care_step:'treat',hair_scope:'selected',hair_types:'wavy',chemistry_scope:'selected',chemistry_types:'treated',care_goals:'hydration|frizz',primary_goal:'frizz',care_review_status:'approved',care_source:'Rótulo conferido pela equipe.'};
test('CSV parser preserves quoted descriptions, semicolons, empty fields and leading zero SKUs',()=>{
 const data=[['sku','description','image'],['000123','Texto; com "aspas"\ne nova linha',''],['ABC','Normal','https://example.com/image']];assert.deepEqual(parseTable('\uFEFF'+serializeTable(data)),data);assert.throws(()=>parseTable('sku;name\nA;"aberta'));assert.deepEqual(parseTable('sku,name\n001,Nome',','),[['sku','name'],['001','Nome']]);
});
test('empty indications remain explicitly unknown; all must be explicit and coherent',()=>{
 const pending=parseMetadata({sku:'P',care_review_status:'pending'});assert.equal(pending.hairScope,'unknown');assert.deepEqual(pending.hair,[]);assert.equal(importPatch(pending).careProfile,undefined);
 const all=parseMetadata({...approved,hair_scope:'all',hair_types:'',chemistry_scope:'all',chemistry_types:''});assert.equal(all.hair.length,4);assert.equal(all.chemistry.length,2);
 for(const edit of [{hair_scope:'all',hair_types:'wavy'},{hair_scope:'unknown'},{hair_types:'ondas'},{primary_goal:'repair'},{care_review_status:'approved',care_source:''}])assert.throws(()=>parseMetadata({...approved,...edit}));
});
test('kit composition rejects repeated, self, zero quantity and missing references',()=>{
 const kit={...approved,sku:'K',product_type:'kit',care_step:'kit',kit_review_status:'approved',kit_components:'P:1|Q:2'};
 const metadata=parseMetadata(kit);validateReferences([{sku:'K',metadata}],new Set(['p','q']));assert.throws(()=>validateReferences([{sku:'K',metadata}],new Set(['p'])));
 for(const components of ['K:1','P:0','P:1|p:2','P:-1','P:1.5','P'])assert.throws(()=>parseMetadata({...kit,kit_components:components}));
 assert.throws(()=>parseMetadata({...kit,kit_components:''}));assert.throws(()=>parseMetadata({...kit,kit_review_status:'pending'}));assert.throws(()=>parseMetadata({...approved,kit_components:'P:1'}));
});
test('pending import does not overwrite reviewed metadata or current care indications',()=>{
 const metadata=parseMetadata(approved),pending=parseMetadata({...approved,care_review_status:'pending'});
 assert.deepEqual(importPatch(pending,{catalogProfile:metadata}),{});
 const patch=importPatch(pending,{careProfile:{hair:['straight']}});assert.equal(patch.careProfile,undefined);
 assert.deepEqual(importPatch(metadata).careProfile,{hair:['wavy'],chemistry:['treated'],goals:['hydration','frizz']});assert.deepEqual(importPatch(null),{});
});
test('all active supplier CSVs have consistent 27-column records and valid kit references',()=>{
 const root=path.resolve(__dirname,'../../..');let total=0,kits=0;
 for(const name of ['Brae.csv','EcoBelle.csv','Inovax.csv','Truss-clean.csv']){
  const rows=parseTable(fs.readFileSync(path.join(root,'data/catalog/sources',name),'utf8')),headers=rows.shift();assert.equal(headers.length,27);for(const column of columns)assert.ok(headers.includes(column));
  const entries=rows.map(values=>{assert.equal(values.length,headers.length);const row=Object.fromEntries(headers.map((h,i)=>[h,values[i]]));const metadata=parseMetadata(row);assert.equal(metadata.reviewStatus,'pending');if(metadata.components.length)kits++;return {sku:row.sku,metadata};});validateReferences(entries,new Set(entries.map(e=>e.sku.toLowerCase())));total+=entries.length;
 }
 assert.equal(total,747);assert.equal(kits,5);
});

test('browser importer retains the extended fields and rejects invalid care values',()=>{
 const vm=require('node:vm'),root=path.resolve(__dirname,'../../..');
 const code=fs.readFileSync(path.join(root,'js/admin/products-importer.js'),'utf8').replace(/^import\s+['"][^'"]+['"];?\s*$/gm,'').replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/gm,'');
 const context={CatalogCsv:require('../../../js/catalog/csv-data'),ProductMetadata:require('../../../js/catalog/product-metadata'),document:{addEventListener(){}},console};
 vm.createContext(context);vm.runInContext(code+'\nthis.convertProduct=normalizeProduct;this.readCsv=parseCSV;',context);
 const row={...approved,source_id:'ecobelle',sku:'000123',name:'Máscara Azul',price:'40.00',stock:'3',weight:'300g',description:'Texto; com\nquebra',category:'Marca',image:'',care_review_status:'pending'};
 const parsed=context.readCsv(serializeTable([Object.keys(row),Object.values(row)])).rows[0];
 const result=context.convertProduct(parsed,'EcoBelle.csv',2);assert.equal(result.ok,true);assert.equal(result.product.sku,'000123');assert.equal(result.product.sourceId,'ecobelle');assert.equal(result.product.catalogProfile.line,'Linha');assert.equal(result.product.description,'Texto; com\nquebra');assert.equal(result.product.careProfile,undefined);
 assert.equal(context.convertProduct({...row,hair_types:'incorreto'},'EcoBelle.csv',2).ok,false);
});
