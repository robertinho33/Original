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
 const extraGoals=({dry:['nutrition','hydration'],damaged:['repair'],frizzy:['frizz']})[input.ends]||[];
 const budget=Math.floor(Number(input.budget)*100+1e-7),rows=[...available.values()].filter(r=>r.product.sourceId==='ecobelle');
 const profile=r=>r.product.recommendationProfile;
 const descending=(a,b)=>b.cents-a.cents||key(a.product.sku).localeCompare(key(b.product.sku));
 const allKits=rows.filter(r=>profile(r)?.type==='kit'&&profile(r).components?.length);
 const primarySingles=rows.filter(r=>profile(r)?.type==='individual'&&fits(profile(r),input));
 let kit=allKits.filter(r=>fits(profile(r),input)).sort(descending)[0],kitGoal=input.goal,reserved;
 if(!kit){
  const supportingGoals=[...new Set([...extraGoals,'hydration','nutrition'])];
  for(const candidate of allKits.slice().sort(descending)){
   const goal=supportingGoals.find(goal=>fits(profile(candidate),{...input,goal}));if(!goal)continue;
   const members=new Set(profile(candidate).components.map(c=>key(c.sku)));
   const target=primarySingles.filter(r=>!members.has(key(r.product.sku))&&r.cents+candidate.cents<=budget).sort(descending)[0];
   // A supporting kit must leave room for the main objective; never substitute it silently.
   if(!target)continue;
   kit=candidate;kitGoal=goal;reserved=target;break;
  }
 }
 const excluded=new Set(kit?[key(kit.product.sku),...profile(kit).components.map(c=>key(c.sku))]:[]);
 const matchedGoal=row=>fits(profile(row),input)?input.goal:['treat','finish'].includes(profile(row)?.step)?extraGoals.find(goal=>profile(row).primaryGoal===goal&&fits(profile(row),{...input,goal})):undefined;
 const singles=rows.filter(r=>profile(r)?.type==='individual'&&!excluded.has(key(r.product.sku))&&r!==reserved&&matchedGoal(r));
 // Value order applies only after factual purpose and explicit restrictions are checked.
 const packed=fillBudget(singles,budget-(kit?.cents||0)-(reserved?.cents||0)),extras=[...(reserved?[reserved]:[]),...packed.rows].sort(descending),selected=kit?[kit,...extras]:extras;
 const products=selected.map(row=>{
  const p=row.product,c=profile(row),limits=[],goal=row===kit?kitGoal:matchedGoal(row);
  if(c.hairScope==='unknown')limits.push('A ficha da fabricante não especifica o tipo de cabelo.');
  if(c.chemistryScope==='unknown')limits.push('A ficha da fabricante não detalha a compatibilidade com química.');
  const labels=(c.components||[]).map(component=>component.name||available.get(key(component.sku))?.product.name||'Item do kit');
  return {sku:p.sku,name:p.name,image:safeImage(p.image),price:row.cents/100,step:c.step,line:c.line,selectionSource:'manufacturer',complementary:Boolean(kit&&row!==kit),
   ...(c.type==='kit'?{kitComponents:labels}:{}),matchedGoal:goal,reason:'Segundo a EcoBelle, esta opção oferece '+(goal==='color'?'matização de tons amarelados para os fios indicados na ficha':options.goals[goal].toLowerCase())+(goal!==input.goal?' para complementar o cuidado do comprimento e das pontas.':'.'),
   matchReasons:[...limits],source:c.source};
 });
 const coverage=new Set(selected.flatMap(r=>profile(r).type==='kit'?profile(r).components.map(c=>c.step||available.get(key(c.sku))?.product.recommendationProfile?.step):[profile(r).step]));
 return {products,total:((kit?.cents||0)+(reserved?.cents||0)+packed.cents)/100,alternatives:[],routineComplete:['wash','condition','treat'].every(s=>coverage.has(s)),missingSteps:['wash','condition','treat','finish'].filter(s=>!coverage.has(s)),line:kit?profile(kit).line:'Sua seleção',
  explanation:'Conheça os produtos da sua seleção. O frete é calculado ao finalizar.',
  message:products.length?'Uma seleção especial para você!':'Ainda não temos opções com finalidade confirmada pela EcoBelle para estas respostas e este valor. Fale com a gente para escolher.'};
}
module.exports={fits,recommendVerified};
