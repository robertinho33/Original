'use strict';
const {normalize:normalizeCare,matches:matchesCare}=require('../../../js/product-care-profile');
const {classify}=require('./catalog-care-candidates');
const {careLine,productRole}=require('./care-lines');
const key=v=>String(v||'').trim().toLowerCase();
const order=['wash','treat','condition','finish'];
const image=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:'';}catch{return '';}};
function compare(a,b){
 for(const field of ['goalFit','pair','fit','mask','finish','finishFit','curated'])if(a[field]!==b[field])return a[field]-b[field];
 return b.cents-a.cents||b.signature.localeCompare(a.signature);
}
function recommendByLine(available,config,input){
 const groups=new Map(),singles=[],choices=new Map();
 const rules=(Array.isArray(config.rules)?config.rules:[]).slice(0,30);
 for(const item of available.values()){
  const profile=normalizeCare(item.product.careProfile);
  if(!matchesCare({...profile,goals:[]},input))continue;
  let info=classify(item.product,input,{allowComplementary:true});const related=rules.filter(r=>key(r.sku)===key(item.product.sku)&&r.goal===input.goal);
  const approved=related.filter(r=>['all',input.hair].includes(r.hair)&&['all',input.chemistry].includes(r.chemistry));
  if(related.length&&!approved.length)continue;
  const rule=approved.sort((a,b)=>(Number(b.hair===input.hair)+Number(b.chemistry===input.chemistry))-(Number(a.hair===input.hair)+Number(a.chemistry===input.chemistry)))[0];
  if(rule&&!matchesCare(profile,input))continue;
  if(!info&&!rule)continue;
  const reviewedOnly=!info;
  if(!info)info={score:0,evidence:['Uma indicação revisada pela equipe da loja.']};
  // A reviewed bundle may be offered alone, but its unknown components must not be duplicated.
  const bundle=reviewedOnly&&/kit|dupla|cronograma|shampoo e condicionador/i.test(item.product.name||'');
  const role=bundle?rule.step:productRole(item.product),line=bundle?null:careLine(item.product);
  const row={...item,role,line,info,rule,fit:rule?Math.max(info.score,16):info.score,curated:Number(Boolean(rule))};singles.push(row);
  if(!line)continue;
  if(!groups.has(line.key))groups.set(line.key,{line,roles:{wash:[],condition:[],treat:[],finish:[]}});
  groups.get(line.key).roles[role].push(row);
 }
 const budget=Math.floor(Number(input.budget)*100+1e-7);
 let best={rows:[],goalFit:0,pair:0,fit:0,mask:0,finish:0,finishFit:0,curated:0,cents:0,signature:'',line:null};
 function consider(rows,line,pair){
  if(new Set(rows.map(r=>key(r.product.sku))).size!==rows.length)return;
  const cents=rows.reduce((sum,r)=>sum+r.cents,0);if(cents>budget)return;
  const base=rows.filter(r=>r.role!=='finish');
  const candidate={rows,line,pair,goalFit:Math.max(0,...base.map(r=>r.rule?4:(r.info.goalStrength||0))),fit:Math.max(0,...base.map(r=>r.fit)),mask:Number(rows.some(r=>r.role==='treat')),finish:Number(rows.some(r=>r.role==='finish')),finishFit:Math.max(0,...rows.filter(r=>r.role==='finish').map(r=>r.fit)),curated:rows.reduce((sum,r)=>sum+r.curated,0),cents,signature:[...rows].sort((a,b)=>order.indexOf(a.role)-order.indexOf(b.role)).map(r=>r.role+':'+key(r.product.sku)).join('|')};
  if(candidate.goalFit<=0)return;
  const choiceKey=line?.key||candidate.signature,previous=choices.get(choiceKey);
  if(!previous||compare(candidate,previous)>0)choices.set(choiceKey,candidate);
  if(compare(candidate,best)>0)best=candidate;
 }
 const cheapest=(a,b)=>a.cents-b.cents||key(a.product.sku).localeCompare(key(b.product.sku));
 for(const group of groups.values()){
  // At most four variants per role: retain fit, curation and affordable options.
  const options={};for(const role of order){const rows=group.roles[role];const ranked=[...rows].sort((a,b)=>b.curated-a.curated||b.fit-a.fit||cheapest(a,b)).slice(0,3);const cheap=[...rows].sort(cheapest).slice(0,1);options[role]=[...new Map([...ranked,...cheap].map(r=>[key(r.product.sku),r])).values()];}
  for(const wash of options.wash)for(const condition of options.condition){
   const base=[wash,condition];if(wash.cents+condition.cents>budget)continue;
   consider(base,group.line,1);
   const masks=options.treat.filter(mask=>wash.cents+condition.cents+mask.cents<=budget);
   if(masks.length){for(const mask of masks){consider([...base,mask],group.line,1);for(const finish of options.finish)consider([...base,mask,finish],group.line,1);}}
   else if(!options.treat.length){for(const finish of options.finish)consider([...base,finish],group.line,1);}
  }
 }
 {
  // Compare relevant single treatments too; an unrelated pair must not hide them.
  for(const row of singles.filter(r=>r.role==='treat'))consider([row],row.line,0);
  if(!best.rows.length)for(const row of singles.filter(r=>r.role==='condition'))consider([row],row.line,0);
  if(!best.rows.length)for(const row of singles)consider([row],row.line,0);
 }
 function project(best){
 const rows=[...best.rows].sort((a,b)=>order.indexOf(a.role)-order.indexOf(b.role));
 const products=rows.map(row=>({sku:String(row.product.sku).slice(0,100),name:String(row.product.name||'').slice(0,200),image:image(row.product.image),price:row.cents/100,step:row.role,line:row.line?.label||'',selectionSource:row.rule?'curated':'catalog',complementary:!row.rule&&!row.info.goalStrength,
  reason:row.rule?String(row.rule.reason).slice(0,400):!best.pair?({wash:'Seu cuidado começa na lavagem. Conheça esta opção para o primeiro passo.',condition:'Uma opção de condicionador para você conhecer.',treat:'Um momento de cuidado para incluir na sua rotina.',finish:'Uma opção para finalizar o seu cuidado.'}[row.role]):({wash:'O primeiro passo da sua rotina, com uma opção da linha '+row.line?.label+'.',condition:'Para acompanhar o shampoo da mesma linha no seu cuidado.',treat:'Um cuidado extra da mesma linha para incluir na sua rotina.',finish:'Para completar o cuidado com mais uma opção da mesma linha.'}[row.role]),
  matchReasons:[...(best.pair?['Shampoo e condicionador da linha '+best.line.label+'.']:[]),...row.info.evidence]}));
 const hasMask=products.some(p=>p.step==='treat'),routineComplete=Boolean(best.pair&&hasMask);
 return {products,total:best.cents/100,routineComplete,line:best.line?.label||'',missingSteps:order.filter(role=>!products.some(p=>p.step===role)),
  explanation:!products.length?'Não encontramos uma indicação para esse perfil dentro do orçamento. Ajuste suas respostas ou peça ajuda à nossa equipe.':best.pair?(hasMask?'Escolhemos shampoo, condicionador e máscara da linha '+best.line.label+' para montar uma rotina coerente, dentro do seu orçamento. Confira as instruções de cada produto para a ordem e a frequência de uso.':'Começamos com shampoo e condicionador da linha '+best.line.label+'. Não encontramos uma máscara da mesma linha compatível com todas as respostas e o valor informado; mantivemos apenas os produtos compatíveis.'):'Escolhemos um cuidado para começar dentro desse valor. Para montar uma rotina com shampoo e condicionador da mesma linha, é preciso haver produtos compatíveis disponíveis; aumentar o orçamento nem sempre resolve. Nossa equipe pode ajudar a conferir outras opções.',
  message:routineComplete?'Sua rotina da mesma linha está pronta para você conhecer.':best.pair?'Uma dupla da mesma linha para começar seu cuidado.':products.length?'Um cuidado para começar, respeitando seu orçamento.':'Ainda não encontramos uma combinação nesse valor. Fale com a gente para escolher suas opções.'};
 }
 const result=project(best);
 const alternatives=[...choices.values()].filter(choice=>choice.rows.length&&choice.line?.key!==best.line?.key&&(!best.pair||choice.pair)).sort((a,b)=>compare(b,a)).slice(0,2).map(project);
 return {...result,alternatives};
}
module.exports={recommendByLine};
