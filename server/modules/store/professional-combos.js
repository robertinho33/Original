'use strict';
// Quantities are fixed; prices and availability always come from the current catalog.
const definitions = [
 {id:'ecobelle-1000',brand:'EcoBelle',target:1000,items:[['75DJZXWT5',2],['63KEV2FBA',2],['WBZA7Q6LP',2],['YDMYK3MK4',1],['HR6LKXYGJ',2],['EJL97KLUE',2],['NJTFJ9RNF',1],['CSH5ETU2N',1]]},
 {id:'ecobelle-800',brand:'EcoBelle',target:800,items:[['75DJZXWT5',2],['63KEV2FBA',2],['WBZA7Q6LP',1],['YDMYK3MK4',1],['HR6LKXYGJ',1],['EJL97KLUE',1],['NJTFJ9RNF',1],['VEHZKS3RJ',1]]},
 {id:'ecobelle-500',brand:'EcoBelle',target:500,items:[['75DJZXWT5',1],['63KEV2FBA',1],['WBZA7Q6LP',1],['YDMYK3MK4',1],['HR6LKXYGJ',1],['EJL97KLUE',1],['P7VJ56493',1]]},
 {id:'bela-pro-1000',brand:'Bela Pro',target:1000,items:[['ZR936JBFC',6],['WXM657UMY',6],['V4M66277J',6],['ASUE5CZGP',6],['XFGMQY4RW',6],['TJFJENBKK',6],['ZKDQ2Y47Q',5]]},
 {id:'bela-pro-800',brand:'Bela Pro',target:800,items:[['ZR936JBFC',4],['WXM657UMY',4],['V4M66277J',4],['RAEKECC87',4],['ASUE5CZGP',4],['XFGMQY4RW',4],['TJFJENBKK',4],['ZKDQ2Y47Q',3],['HCNTRBT4Z',1]]},
 {id:'bela-pro-500',brand:'Bela Pro',target:500,items:[['ZR936JBFC',3],['WXM657UMY',3],['V4M66277J',3],['ASUE5CZGP',3],['XFGMQY4RW',3],['TJFJENBKK',3],['RAEKECC87',4]]}
];
function buildCombos(products){
 const catalog=new Map(products.map(p=>[p.sku,p]));
 return definitions.map(def=>{
  let available=true;
  const items=def.items.map(([sku,quantity])=>{
   const p=catalog.get(sku),unitCents=Math.round(Number(p?.price)*100);
   if(!p||p.active!==true||!Number.isInteger(p.stock)||p.stock<quantity||!Number.isSafeInteger(unitCents)||unitCents<=0)available=false;
   return {sku,quantity,name:p?.name||'Produto indisponível',image:/^https:\/\//.test(p?.image||'')?p.image:'',unitCents:Number.isSafeInteger(unitCents)&&unitCents>0?unitCents:0};
  });
  const subtotalCents=items.reduce((sum,p)=>sum+p.unitCents*p.quantity,0);
  const discountCents=subtotalCents-Math.round(subtotalCents*75/100);
  return {id:def.id,brand:def.brand,target:def.target,items,available,discountPercent:25,subtotalCents,discountCents,totalCents:subtotalCents-discountCents,units:items.reduce((sum,p)=>sum+p.quantity,0)};
 });
}
function registerProfessionalCombos(app,{getProducts=require('../catalog/catalog-storefront-service').getPublicCatalog}={}){
 app.get('/api/professional-combos',async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{res.json({combos:buildCombos(await getProducts())});}
  catch{res.status(503).json({error:'Não foi possível consultar os combos agora. Tente novamente em instantes.'});}
 });
}
module.exports={definitions,buildCombos,registerProfessionalCombos};
