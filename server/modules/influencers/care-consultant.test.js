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

// Kits may fill the budget only after compatibility and duplicate-stage checks.
test('budget above 120 can combine a 120 kit, 40 mask and 35 finish without exceeding 200',()=>{
 const profile={hair:['straight'],chemistry:['natural'],goals:['hydration']};
 const kit={sku:'KIT',name:'Kit HidraSim EcoBelle',description:'Contém shampoo e condicionador.',price:120,stock:2,careProfile:profile};
 const mask={sku:'MASK',name:'Máscara HidraSim EcoBelle',price:40,stock:2,careProfile:profile};
 const finish={sku:'FINISH',name:'Sérum HidraSim EcoBelle',price:35,stock:2,careProfile:profile};
 const rows=[kit,mask,finish],result=recommend(config,rows,input);
 assert.equal(result.total,195);assert.deepEqual(new Set(result.products.map(p=>p.sku)),new Set(['KIT','MASK','FINISH']));assert.equal(result.routineComplete,true);
 assert.deepEqual(result,recommend(config,[...rows].reverse(),input));
 assert.ok(!recommend(config,rows,{...input,budget:120}).products.some(p=>p.sku==='KIT'));
 const cents=recommend(config,rows,{...input,budget:194.99});assert.ok(cents.total<=194.99);
 assert.ok(!recommend(config,rows,{...input,hair:'curly'}).products.some(p=>p.sku==='KIT'));
 assert.ok(!recommend(config,[{...kit,stock:0},mask,finish],input).products.some(p=>p.sku==='KIT'));
});
test('kits with unknown contents stay standalone; included mask is never duplicated',()=>{
 const profile={goals:['hydration']};const kit={sku:'KIT',name:'Kit HidraSim EcoBelle',description:'Shampoo, condicionador e máscara.',price:120,stock:2,careProfile:profile};
 const rows=[kit,{sku:'MASK',name:'Máscara HidraSim EcoBelle',price:40,stock:1,careProfile:profile},{sku:'FIN',name:'Sérum HidraSim EcoBelle',price:35,stock:1,careProfile:profile}];
 const result=recommend(config,rows,input);assert.equal(result.total,155);assert.ok(!result.products.some(p=>p.sku==='MASK'));
 const unknown={...kit,name:'Kit Especial',description:''};const curated={...config,rules:[{sku:'KIT',goal:'hydration',hair:'all',chemistry:'all',step:'treat',reason:'Kit revisado pela equipe.'}]};
 const standalone=recommend(curated,[unknown,...rows.slice(1)],input);assert.equal(standalone.products.length,1);assert.equal(standalone.total,120);
});

test('complete catalog kit is one option and its included items never become complements',()=>{
 const catalog=require('../../../data/catalog/catalog-runtime.json').products;
 const kit=catalog.find(p=>p.sku==='LPGSTQBW8');
 const singles=catalog.filter(p=>['ASUE5CZGP','TJFJENBKK','ZKDQ2Y47Q'].includes(p.sku));
 const result=recommend(config,[kit,...singles],{...input,budget:200});
 assert.equal(result.products[0].sku,'LPGSTQBW8');assert.equal(result.products[0].step,'kit');
 assert.deepEqual(result.products[0].kitComponents,['Shampoo','Condicionador','Máscara','Sérum']);
 assert.equal(result.products.length,1);assert.equal(result.total,kit.price);assert.deepEqual(result.alternatives,[]);
});
test('profile-approved kit without text is recognized; missing composition blocks extra items',()=>{
 const kit={sku:'K',name:'Kit Especial',price:120,stock:1,careProfile:{goals:['hydration']}};
 const finish={sku:'S',name:'Sérum HidraSim Bela Pro',price:40,stock:1};
 const result=recommend(config,[kit,finish],input);assert.equal(result.products[0].sku,'K');assert.equal(result.products.length,1);
});
test('complete kit remains primary even when separate products could spend more',()=>{
 const profile={goals:['hydration']};
 const kit={sku:'K',name:'Kit HidraSim Bela Pro',description:'Shampoo, condicionador e máscara.',price:120,stock:1,careProfile:profile};
 const parts=line('HidraSim','',60,profile).map(p=>({...p,name:p.name.replace('EcoBelle','Bela Pro')}));
 const result=recommend(config,[kit,...parts],input);assert.equal(result.products[0].sku,'K');assert.equal(result.total,120);assert.equal(result.products.length,1);assert.deepEqual(result.alternatives,[]);
});

test('individuals are considered from higher to lower price, skipping those that do not fit',()=>{
 const {fillBudget}=require('./budget-fill');
 const rows=[70,40,30,20,10].map((cents,i)=>({product:{sku:String(i)},cents}));
 const result=fillBudget(rows,100);assert.deepEqual(result.rows.map(r=>r.cents),[70,30]);assert.equal(result.cents,100);
 const remainder=fillBudget(rows,95);assert.deepEqual(remainder.rows.map(r=>r.cents),[70,20]);assert.equal(remainder.cents,90);
 assert.deepEqual(result,fillBudget([...rows].reverse(),100));
 const ties=[{product:{sku:'B'},cents:30},{product:{sku:'A'},cents:30}];assert.equal(fillBudget(ties,30).rows[0].product.sku,'A');
});
test('490 budget supports more than two general complements outside the 269 kit',()=>{
 const answers={hair:'wavy',chemistry:'treated',goal:'frizz',budget:490};
 const kit={sku:'K269',name:'Kit Coco & Camomila EcoBelle',description:'Shampoo, condicionador, máscara e finalizador.',price:269,stock:2,careProfile:{goals:['frizz']}};
 const extras=[45,35,40,60,30].map((price,i)=>({sku:'EXTRA'+i,name:'Máscara Linha Especial '+i+' EcoBelle',price,stock:2,careProfile:{hair:['wavy'],chemistry:['treated'],goals:['hydration']}}));
 const result=recommend(config,[kit,...extras],answers);assert.equal(result.products[0].sku,'K269');assert.equal(result.products.length,6);assert.equal(result.total,479);assert.equal(result.products.slice(1).every(p=>p.complementary),true);
 const restricted={...extras[0],sku:'NATURAL_ONLY',price:1,careProfile:{chemistry:['natural']}};
 assert.ok(!recommend(config,[kit,...extras,restricted],answers).products.some(p=>p.sku==='NATURAL_ONLY'));
 assert.deepEqual(result,recommend(config,[...extras].reverse().concat(kit),answers));
});
test('large limits and cent prices produce exact unique selections',()=>{
 const {fillBudget}=require('./budget-fill');const rows=Array.from({length:25},(_,i)=>({product:{sku:String(i)},cents:790+i*37}));const result=fillBudget(rows,12345);assert.ok(result.cents<=12345);assert.equal(result.rows.length,new Set(result.rows.map(r=>r.product.sku)).size);assert.equal(result.cents,result.rows.reduce((n,r)=>n+r.cents,0));assert.equal(fillBudget(rows,1000000).rows.length,rows.length);
});

test('products excluded during catalog review remain outside both automatic and curated recommendations',()=>{
 const product={sku:'EXCLUDED',name:'Máscara HidraSim Bela Pro',price:30,stock:5,careReviewStatus:'excluded',careProfile:{goals:['hydration']}};
 assert.equal(recommend(config,[product],input).products.length,0);
 const manual={enabled:true,automatic:false,rules:[{sku:product.sku,step:'treat',goal:'hydration',hair:'all',chemistry:'all',reason:'Indicação antiga.'}]};assert.equal(recommend(manual,[product],input).products.length,0);
 assert.equal(recommend(config,[{...product,careReviewStatus:'pending'}],input).products.length,1);
});
