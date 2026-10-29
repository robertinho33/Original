'use strict';
const {normalize,matches}=require('../../../js/product-care-profile');
const {classify}=require('./catalog-care-candidates');
const {careLine,productRole}=require('./care-lines');
const {composition}=require('./kit-composition');
const {fillBudget}=require('./budget-fill');
const plain=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const key=v=>plain(v).trim();
const safeImage=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function budgetSelection(base,available,config,input){
 const budget=Math.floor(Number(input.budget)*100+1e-7);if(budget<=12000)return base;
 const rules=Array.isArray(config.rules)?config.rules.slice(0,30):[];
 const baselineStrength=Math.max(0,...base.products.map(p=>{const original=available.get(key(p.sku))?.product;return original?(classify(original,input)?.goalStrength||0):0;}));
 const kits=[];const extras=[];
 for(const row of available.values()){
  const p=row.product,profile=normalize(p.careProfile);if(!matches({...profile,goals:[]},input))continue;
  const name=plain(p.name),text=name+' '+plain(p.description);
  if(/\bkit\b|\bdupla\b|cronograma/.test(name)){
   if(!matches(profile,input))continue;
   if(/progressiv|alisant|botox|formol|descolor|oxidante|coloracao|tonalizante|matizador|acidificante|selante/.test(text))continue;
   const related=rules.filter(r=>key(r.sku)===key(p.sku)&&r.goal===input.goal);
   const approved=related.find(r=>['all',input.hair].includes(r.hair)&&['all',input.chemistry].includes(r.chemistry));
   if(related.length&&!approved)continue;
   const contents=composition(p);
   const info=classify({...p,name:name.replace(/\bkit\b|\bdupla\b|cronograma/g,'').replace(/shampoo e condicionador/g,'shampoo condicionador'),categoryName:(p.categoryName||'')+' shampoo'},input);
   const strength=approved||profile.goals.includes(input.goal)?4:info?.goalStrength||0;
   if(!strength||(!info&&!approved))continue;
   const coverage=new Set(contents?.roles||[]);if(/shampoo/.test(text))coverage.add('wash');if(/condicionador/.test(text))coverage.add('condition');if(/mascara/.test(text))coverage.add('treat');if(/finalizador|leave.in|serum/.test(text))coverage.add('finish');
   // Unknown kit contents remain a standalone suggestion: never add potentially repeated steps.
   kits.push({...row,curated:Boolean(approved),coverage,line:careLine(p),strength,contents,reason:approved?.reason||'Kit compatível com seu objetivo e com as informações disponíveis no catálogo.'});
  }else{
   const info=classify(p,input,{allowComplementary:true});if(info)extras.push({...row,info,role:productRole(p),line:careLine(p)});
  }
 }
 // Choose the kit before considering any individual product or its price.
 const kit=kits.sort((a,b)=>b.strength-a.strength||b.cents-a.cents||key(a.product.sku).localeCompare(key(b.product.sku))).find(kit=>kit.strength>=baselineStrength);
 if(!kit)return base;
 const options=kit.coverage.size>=2?extras.filter(row=>!(kit.line&&row.line?.key===kit.line.key&&kit.coverage.has(row.role))):[];
 const packed=fillBudget(options,budget-kit.cents),best={kit,rows:[kit,...packed.rows],cents:kit.cents+packed.cents};
 const coverage=new Set([...best.kit.coverage,...best.rows.slice(1).map(row=>row.role)]);
 const products=best.rows.map((row,index)=>({sku:String(row.product.sku),name:String(row.product.name||''),price:row.cents/100,image:safeImage(row.product.image),step:index?row.role:'kit',line:row.line?.label||'',selectionSource:row.curated?'curated':'catalog',...(index?{complementary:true}:{kitComponents:row.contents?.labels||[]}),reason:index?(row.info.goalStrength?'Um produto de outra linha compatível com suas respostas, fora dos componentes do kit.':'Uma sugestão adicional para conhecer; não é uma indicação específica para seu objetivo principal.'):best.kit.reason,matchReasons:[index?'Produto não incluído no kit sugerido.':'Selecionado de acordo com seu perfil e seu objetivo.','Valor considerado no total da sua seleção.']}));
 const option={products,total:best.cents/100,line:best.kit.line?.label||'Kit e cuidados',routineComplete:['wash','condition','treat'].every(role=>coverage.has(role)),missingSteps:['wash','condition','treat','finish'].filter(role=>!coverage.has(role)),message:'Uma seleção com kit, próxima do valor que você escolheu.',explanation:'Conheça os produtos da sua seleção. O frete é calculado ao finalizar.'};
 return {...option,alternatives:[]};
}
module.exports={budgetSelection};
