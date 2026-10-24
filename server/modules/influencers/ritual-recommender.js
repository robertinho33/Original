'use strict';
const goals={hydration:'Hidratação e maciez',repair:'Cuidado de fios danificados',frizz:'Controle do frizz',curls:'Definição dos cachos',color:'Cuidado da cor'};
const hairs={straight:'cabelos lisos',wavy:'cabelos ondulados',curly:'cabelos cacheados',coily:'cabelos crespos'};
const steps=['wash','treat','finish'];
const {automaticCandidates}=require('./catalog-care-candidates');
const key=value=>String(value??'').trim().toLowerCase();
function image(value){try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:'';}catch{return '';}}
function compare(a,b){
  // Preserve treatment priority, then complete as many stages as possible.
  for(const field of ['treatment','count','curated','specificity'])if(a[field]!==b[field])return a[field]-b[field];
  if(a.cents!==b.cents)return b.cents-a.cents;
  return b.signature.localeCompare(a.signature);
}
function recommend(config,catalog,input={}){
  if(!input||Array.isArray(input)||typeof input.goal!=='string'||typeof input.hair!=='string'||!Object.hasOwn(goals,input.goal)||!Object.hasOwn(hairs,input.hair)||!['treated','natural'].includes(input.chemistry))throw Error('Confira suas respostas para encontrar seu cuidado.');
  const budget=Number(input.budget);
  if(!['number','string'].includes(typeof input.budget)||!Number.isFinite(budget)||budget<1||budget>10000)throw Error('Informe um orçamento entre R$ 1 e R$ 10.000.');
  if(!config?.enabled)return {products:[],total:0,message:'A loja está preparando as recomendações. Fale conosco para encontrar o cuidado do seu jeito.'};
  const budgetCents=Math.floor(budget*100+1e-7),bySku=new Map();
  for(const product of catalog){
    const cents=Math.round(Number(product.price)*100),stock=Number(product.stock);
    if(product.active!==false&&!/^inativo/i.test(product.name||'')&&Number.isFinite(stock)&&stock>=1&&Number.isFinite(cents)&&cents>0&&cents<=budgetCents)bySku.set(key(product.sku),{product,cents});
  }
  const candidates=Object.fromEntries(steps.map(step=>[step,new Map()]));
  // The saved curation permits at most 30 rows. Keep work bounded for older/malformed documents too.
  for(const rule of (Array.isArray(config.rules)?config.rules:[]).slice(0,30)){
    if(!rule||rule.goal!==input.goal||!steps.includes(rule.step)||!String(rule.reason||'').trim()||
      !['all',input.hair].includes(rule.hair)||!['all',input.chemistry].includes(rule.chemistry))continue;
    const found=bySku.get(key(rule.sku));if(!found)continue;
    const specificity=Number(rule.hair===input.hair)+Number(rule.chemistry===input.chemistry);
    const candidate={...found,rule,specificity,curated:1},previous=candidates[rule.step].get(key(rule.sku));
    if(!previous||specificity>previous.specificity)candidates[rule.step].set(key(rule.sku),candidate);
  }
  if(config.automatic===true){
    for(const candidate of automaticCandidates(bySku,config,input)){
      const group=candidates[candidate.rule.step],sku=key(candidate.product.sku);
      if(!group.has(sku))group.set(sku,candidate);
    }
  }
  let best={rows:[],treatment:0,count:0,curated:0,specificity:0,cents:0,signature:''};
  function visit(index,rows,cents,used){
    if(index===steps.length){
      const selection={rows,treatment:Number(rows.some(row=>row.rule.step==='treat')),count:rows.length,curated:rows.reduce((sum,row)=>sum+(row.curated||0),0),specificity:rows.reduce((sum,row)=>sum+row.specificity,0),cents,
        signature:rows.map(row=>row.rule.step+':'+key(row.product.sku)).join('|')};
      if(compare(selection,best)>0)best=selection;return;
    }
    visit(index+1,rows,cents,used);
    for(const row of candidates[steps[index]].values()){
      const sku=key(row.product.sku);
      if(used.has(sku)||cents+row.cents>budgetCents)continue;
      visit(index+1,[...rows,row],cents+row.cents,new Set([...used,sku]));
    }
  }
  visit(0,[],0,new Set());
  const products=best.rows.map(({product,rule,cents,automatic,evidence})=>({sku:String(product.sku).slice(0,100),name:String(product.name||'').slice(0,200),image:image(product.image),price:cents/100,step:rule.step,reason:String(rule.reason).trim().slice(0,400),selectionSource:automatic?'catalog':'curated',
    matchReasons:automatic?evidence:[`Objetivo da curadoria: ${goals[input.goal]}.`,rule.hair==='all'?'Indicação da loja para todos os tipos de cabelo.':`Indicação da loja para ${hairs[input.hair]}.`,
      rule.chemistry==='all'?'Curadoria com ou sem química.':input.chemistry==='treated'?'Curadoria para cabelos com química ou coloração.':'Curadoria para cabelos sem química.']}));
  return {products,total:best.cents/100,
    explanation:config.automatic===true?'Combinamos as etapas e preços dentro do orçamento, priorizando tratamento e o maior número de etapas. Entre seleções com as mesmas etapas, priorizamos as indicações revisadas da loja, os termos do cadastro relacionados às respostas e o menor total. As alternativas automáticas são identificadas; informações ausentes no cadastro não confirmam compatibilidade.':'Cruzamos suas respostas com as indicações revisadas pela loja. Priorizamos tratamento e a combinação com mais etapas dentro do orçamento; entre essas combinações, escolhemos a mais específica para seu perfil. Em caso de empate, priorizamos o menor total.',
    missingSteps:steps.filter(step=>!products.some(product=>product.step===step)),
    message:products.length===3?'Sua seleção reúne três etapas dentro do orçamento.':products.length?'Montamos uma seleção parcial dentro do orçamento e das indicações disponíveis.':'Não encontramos uma indicação disponível dentro desse orçamento. Você pode ajustar o valor ou falar com a loja.'};
}
module.exports={recommend};
