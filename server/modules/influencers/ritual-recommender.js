'use strict';
const goals={hydration:'Hidratação e maciez',repair:'Cuidado de fios danificados',frizz:'Controle do frizz',curls:'Definição dos cachos',color:'Cuidado da cor',nutrition:'Nutrição dos fios',oiliness:'Controle da oleosidade'};
const hairs={straight:'cabelos lisos',wavy:'cabelos ondulados',curly:'cabelos cacheados',coily:'cabelos crespos'};
const steps=['wash','treat','finish'];
const {recommendByLine}=require('./line-care-selector');
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
  if(input.ends!==undefined&&!['normal','dry','damaged','frizzy'].includes(input.ends))throw Error('Confira como estão o comprimento e as pontas.');
  if(input.shade!==undefined&&!['blonde','grey','other'].includes(input.shade))throw Error('Confira o tom dos seus cabelos.');
  if(!['number','string'].includes(typeof input.budget)||!Number.isFinite(budget)||budget<1||budget>10000)throw Error('Informe um orçamento entre R$ 1 e R$ 10.000.');
  if(!config?.enabled)return {products:[],total:0,message:'Nossa equipe pode ajudar você a escolher. Fale com a gente para encontrar suas opções.'};
  const budgetCents=Math.floor(budget*100+1e-7),bySku=new Map();
  for(const product of catalog){
    const cents=Math.round(Number(product.price)*100),stock=Number(product.stock);
    if(product.careReviewStatus!=='excluded'&&product.active!==false&&!/^inativo/i.test(product.name||'')&&Number.isFinite(stock)&&stock>=1&&Number.isFinite(cents)&&cents>0&&cents<=budgetCents)bySku.set(key(product.sku),{product,cents});
  }
  if(config.manufacturerEvidence==='ecobelle'||config.automatic===true&&catalog.some(p=>p.sourceId==='ecobelle'&&p.recommendationProfile))return require('./verified-care-selector').recommendVerified(bySku,input);
  if(config.automatic===true)return require('./budget-selection').budgetSelection(recommendByLine(bySku,config,input),bySku,config,input);
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
    matchReasons:automatic?evidence:[`Uma indicação da nossa equipe para quem busca ${goals[input.goal].toLowerCase()}.`,rule.hair==='all'?'A equipe selecionou esta opção para diferentes tipos de cabelo.':`Uma escolha da nossa equipe para ${hairs[input.hair]}.`,
      rule.chemistry==='all'?'Na seleção da equipe, esta opção atende fios com ou sem química. Confira também as instruções de uso.':input.chemistry==='treated'?'A equipe incluiu esta opção para fios com química ou coloração.':'A equipe incluiu esta opção para fios sem química.']}));
  return {products,total:best.cents/100,
    explanation:products.length===3?'Separamos opções para lavar, cuidar e finalizar, dentro do valor que você escolheu. Conheça cada produto e leve os seus favoritos.':'Encontramos estas opções dentro do valor que você escolheu. Conheça os produtos ou ajuste o orçamento para explorar outras combinações.',
    missingSteps:steps.filter(step=>!products.some(product=>product.step===step)),
    message:products.length===3?'Pronto! Três passos para o seu cuidado, dentro do seu orçamento.':products.length?'Encontramos opções para começar seu cuidado dentro desse valor.':'Ainda não encontramos uma combinação nesse valor. Experimente outro orçamento ou peça ajuda à nossa equipe.'};
}
module.exports={recommend};
