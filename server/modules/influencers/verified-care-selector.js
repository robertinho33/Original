'use strict';
const {fillBudget}=require('./budget-fill');
const {options}=require('../../../js/product-care-profile');
const key=v=>String(v||'').trim().toLowerCase();
const safeImage=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function fits(p,input){
 if(!p?.verified||!p.goals?.includes(input.goal))return false;
 if(p.hairScope!=='unknown'&&!p.hair?.includes(input.hair))return false;
 if(p.chemistryScope!=='unknown'&&!p.chemistry?.includes(input.chemistry))return false;
 return !(p.restrictions||[]).some(r=>['professional_only','chemical_service'].includes(r)||r==='blonde_only'&&!(input.goal==='color'&&input.shade==='blonde')||r==='light_tones_only'&&!(input.goal==='color'&&['blonde','grey'].includes(input.shade)));
}
function recommendVerified(available,input){
 const budget=Math.floor(Number(input.budget)*100+1e-7),rows=[...available.values()].filter(r=>r.product.sourceId==='ecobelle'&&fits(r.product.recommendationProfile,input));
 const profile=r=>r.product.recommendationProfile;
 const rank=r=>Number(profile(r).primaryGoal===input.goal)*10+Number(profile(r).hairScope!=='unknown')*2+Number(profile(r).chemistryScope!=='unknown');
 const kits=rows.filter(r=>profile(r).type==='kit'&&profile(r).components?.length);
 const kit=budget>12000?kits.sort((a,b)=>rank(b)-rank(a)||b.cents-a.cents||key(a.product.sku).localeCompare(key(b.product.sku)))[0]:null;
 const excluded=new Set(kit?[key(kit.product.sku),...profile(kit).components.map(c=>key(c.sku))]:[]);
 const singles=rows.filter(r=>profile(r).type==='individual'&&!excluded.has(key(r.product.sku)));
 // Value order applies only after factual purpose and explicit restrictions are checked.
 const packed=fillBudget(singles,budget-(kit?.cents||0)),selected=kit?[kit,...packed.rows]:packed.rows;
 const products=selected.map(row=>{
  const p=row.product,c=profile(row),limits=[];
  if(c.hairScope==='unknown')limits.push('A ficha da fabricante não especifica o tipo de cabelo.');
  if(c.chemistryScope==='unknown')limits.push('A ficha da fabricante não detalha a compatibilidade com química.');
  const labels=(c.components||[]).map(component=>component.name||available.get(key(component.sku))?.product.name||'Item do kit');
  return {sku:p.sku,name:p.name,image:safeImage(p.image),price:row.cents/100,step:c.step,line:c.line,selectionSource:'manufacturer',complementary:Boolean(kit&&row!==kit),
   ...(c.type==='kit'?{kitComponents:labels}:{}),reason:'Segundo a EcoBelle, esta opção oferece '+(input.goal==='color'?'matização de tons amarelados para os fios indicados na ficha':options.goals[input.goal].toLowerCase())+'.',
   matchReasons:[...limits],source:c.source};
 });
 const coverage=new Set(selected.flatMap(r=>profile(r).type==='kit'?profile(r).components.map(c=>c.step||available.get(key(c.sku))?.product.recommendationProfile?.step):[profile(r).step]));
 return {products,total:((kit?.cents||0)+packed.cents)/100,alternatives:[],routineComplete:['wash','condition','treat'].every(s=>coverage.has(s)),missingSteps:['wash','condition','treat','finish'].filter(s=>!coverage.has(s)),line:kit?profile(kit).line:'Sua seleção',
  explanation:'Conheça os produtos da sua seleção. O frete é calculado ao finalizar.',
  message:products.length?'Uma seleção especial para você!':'Ainda não temos opções com finalidade confirmada pela EcoBelle para estas respostas e este valor. Fale com a gente para escolher.'};
}
module.exports={fits,recommendVerified};
