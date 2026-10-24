'use strict';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stageNames={wash:'Limpar',treat:'Tratar',finish:'Finalizar'};
const goalWords={hydration:/hidrat|hidrasim|maciez/,repair:/repar|reconstr|reestrutur|danific|quebra/,frizz:/frizz/,curls:/cach|curly|curlys|crespo|definicao/,color:/protecao da cor|coloridos|color protection|cuidado da cor/};
function classify(product,input){
 const name=normalize(product.name),category=normalize(product.categoryName||product.category),description=normalize(product.description),text=name+' '+category+' '+description;
 // Ambiguous kits and chemical/professional/color-changing products require human curation.
 if(/kit|dupla|cronograma|shampoo e condicionador/.test(name)||/skin|facial|body splash|barber|barba|esfoliante/.test(name+' '+category)||
  /selante|progressiv|alisant|botox|formol|descolor|oxidante|emulsao|\box\d*\b|coloracao|tonalizante|permanente|ironed|matizador|matizadora|acidificante/.test(name))return null;
 let step;if(/\bshampoo\b/.test(name+' '+category))step='wash';
 else if(/mascara|condicionador|tratamento/.test(name+' '+category))step='treat';
 else if(/finalizador|leave[ -]?in|creme de pentear|ativador de cachos|protetor termico|reparador de pontas|oleo de|serum capilar|perfume capilar/.test(name+' '+category))step='finish';
 if(!step)return null;
 const curly=/cach|curly|curlys|crespo/.test(name),straight=/\bliso\b|\blisos\b/.test(name),wavy=/ondulad/.test(name);
 if(curly&&!['curly','coily'].includes(input.hair)||straight&&input.hair!=='straight'||wavy&&input.hair!=='wavy')return null;
 const treated=/pos[ -]?quimica|quimicamente tratados|cabelos coloridos/.test(text),natural=/cabelos sem quimica|apenas cabelos naturais/.test(text);
 if(treated&&input.chemistry!=='treated'||natural&&input.chemistry!=='natural')return null;
 const goalMatch=goalWords[input.goal].test(text),hairMatch=curly||straight||wavy;
 const evidence=[
  'Categoria identificada no nome ou cadastro: '+stageNames[step]+'.',
  goalMatch?'O nome ou descrição contém termos relacionados ao objetivo escolhido.':'O cadastro não confirma o objetivo escolhido; esta alternativa foi selecionada por categoria e preço.',
  hairMatch?'O nome menciona o tipo de cabelo selecionado.':'O cadastro não informa um tipo de cabelo específico.',
  treated||natural?'O cadastro menciona a condição de química selecionada.':'A compatibilidade com química ou coloração não está informada no cadastro; confira o rótulo.'
 ];
 return {step,score:Number(goalMatch)*4+Number(hairMatch)*2+Number(treated||natural),evidence};
}
function automaticCandidates(available,config,input){
 const rows=[];
 for(const found of available.values()){
  const sku=String(found.product.sku).trim().toLowerCase();
  const rules=(Array.isArray(config.rules)?config.rules:[]).slice(0,30).filter(r=>String(r.sku).trim().toLowerCase()===sku && r.goal===input.goal);
  if(rules.length&&!rules.some(r=>['all',input.hair].includes(r.hair)&&['all',input.chemistry].includes(r.chemistry)))continue;
  const info=classify(found.product,input);if(!info)continue;
  rows.push({...found,curated:0,specificity:info.score,automatic:true,evidence:info.evidence,
   rule:{sku,step:info.step,reason:'Alternativa automática por categoria e preço. Confira as indicações de uso no rótulo.'}});
 }
 const stable=(a,b)=>a.cents-b.cents||String(a.product.sku).localeCompare(String(b.product.sku));
 const result=[];
 for(const step of ['wash','treat','finish']){
  const options=rows.filter(r=>r.rule.step===step);
  // Keep cheap alternatives as well as the highest matches; bound combination search.
  const best=[...options].sort((a,b)=>b.specificity-a.specificity||stable(a,b)).slice(0,24);
  const cheapest=[...options].sort(stable).slice(0,8);
  const unique=new Map([...best,...cheapest].map(r=>[String(r.product.sku).toLowerCase(),r]));result.push(...unique.values());
 }
 return result;
}
module.exports={classify,automaticCandidates};
