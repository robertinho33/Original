'use strict';
// Quantities are fixed; prices and availability always come from the current catalog.
const definitions = [
 {id:'ecobelle-1000',brand:'EcoBelle',target:1000,items:[['3SSKRFEP5',2],['PML3C9J4M',2],['WBZA7Q6LP',2],['YDMYK3MK4',2],['EJL97KLUE',2]]},
 {id:'ecobelle-800',brand:'EcoBelle',target:800,items:[['3SSKRFEP5',2],['PML3C9J4M',2],['YDMYK3MK4',2],['EJL97KLUE',1],['HR6LKXYGJ',1]]},
 {id:'ecobelle-500',brand:'EcoBelle',target:500,items:[['3SSKRFEP5',1],['PML3C9J4M',1],['WBZA7Q6LP',1],['YDMYK3MK4',1],['EJL97KLUE',1]]},
 {id:'bela-pro-1000',brand:'Bela Pro',target:1000,items:[['LPGSTQBW8',5],['YYYS5P629',5],['HCNTRBT4Z',1]]},
 {id:'bela-pro-800',brand:'Bela Pro',target:800,items:[['LPGSTQBW8',4],['YYYS5P629',4],['P3SMM9FXM',1],['FMC93GCXT',1]]},
 {id:'bela-pro-500',brand:'Bela Pro',target:500,items:[['LPGSTQBW8',3],['YYYS5P629',2],['P3SMM9FXM',1]]}
];
function buildCombos(products){
 const catalog=new Map(products.map(p=>[p.sku,p]));
 return definitions.map(def=>{
  let available=true;
  const items=def.items.map(([sku,quantity])=>{
   const p=catalog.get(sku),unitCents=Math.round(Number(p?.price)*100);
   if(!p||p.active!==true||!Number.isInteger(p.stock)||p.stock<quantity||!Number.isSafeInteger(unitCents)||unitCents<=0)available=false;
   const discountedUnitCents=Number.isSafeInteger(unitCents)&&unitCents>0?Math.round(unitCents*70/100):0;
   return {sku,quantity,discountedUnitCents,name:p?.name||'Produto indisponível',image:/^https:\/\//.test(p?.image||'')?p.image:'',unitCents:Number.isSafeInteger(unitCents)&&unitCents>0?unitCents:0};
  });
  const subtotalCents=items.reduce((sum,p)=>sum+p.unitCents*p.quantity,0);
  const totalCents=items.reduce((sum,p)=>sum+p.discountedUnitCents*p.quantity,0);
  const discountCents=subtotalCents-totalCents;
  return {id:def.id,brand:def.brand,target:def.target,items,available,discountPercent:30,subtotalCents,discountCents,totalCents:subtotalCents-discountCents,units:items.reduce((sum,p)=>sum+p.quantity,0)};
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
