'use strict';
const {normalize:normalizeCare,matches:matchesCare}=require('../../../js/product-care-profile');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stageReasons={wash:'Seu cuidado começa na lavagem. Conheça esta opção para o primeiro passo.',treat:'Um momento de cuidado para incluir depois da lavagem.',finish:'O toque final para completar sua rotina.'};
const goalNames={hydration:'hidratação e maciez',repair:'cuidado dos fios danificados',frizz:'controle do frizz',curls:'definição dos cachos',color:'cuidado da cor'};
const goalWords={hydration:/hidrat|hidrasim|maciez/,repair:/repar|reconstr|reestrutur|danific|quebra/,frizz:/frizz/,curls:/cach|curly|curlys|crespo|definicao/,color:/protecao da cor|coloridos|color protection|cuidado da cor/};
function classify(product,input){
 const profile=normalizeCare(product.careProfile);if(!matchesCare(profile,input))return null;
 const name=normalize(product.name),category=normalize(product.categoryName||product.category),description=normalize(product.description),text=name+' '+category+' '+description;
 // Ambiguous kits and chemical/professional/color-changing products require human curation.
 if(/kit|dupla|cronograma|shampoo e condicionador/.test(name)||/skin|facial|body splash|barber|barba|esfoliante/.test(name+' '+category)||
  /selante|progressiv|alisant|botox|formol|descolor|oxidante|emulsao|\box\d*\b|coloracao|tonalizante|permanente|ironed|matizador|matizadora|acidificante/.test(name))return null;
 let step;if(/\bshampoo\b/.test(name+' '+category))step='wash';
 else if(/mascara|condicionador|tratamento/.test(name+' '+category))step='treat';
 else if(/finalizador|leave[ -]?in|creme de pentear|ativador de cachos|protetor termico|reparador de pontas|oleo de|serum capilar|serum hidrasim|serum nutrisim|perfume capilar/.test(name+' '+category))step='finish';
 if(!step)return null;
 const curly=/cach|curly|curlys|crespo/.test(name),straight=/\bliso\b|\blisos\b/.test(name),wavy=/ondulad/.test(name);
 if(!profile.hair.length&&(curly&&!['curly','coily'].includes(input.hair)||straight&&input.hair!=='straight'||wavy&&input.hair!=='wavy'))return null;
 const treated=/pos[ -]?quimica|quimicamente tratados|cabelos coloridos/.test(text),natural=/cabelos sem quimica|apenas cabelos naturais/.test(text);
 if(!profile.chemistry.length&&(treated&&input.chemistry!=='treated'||natural&&input.chemistry!=='natural'))return null;
 // Explicit care metadata and product purpose outweigh incidental description words.
 const goalStrength=profile.goals.includes(input.goal)?4:goalWords[input.goal].test(name)?3:goalWords[input.goal].test(description)?1:0;
 const goalMatch=goalStrength>0,hairMatch=profile.hair.includes(input.hair)||curly||straight||wavy;
 const evidence=[
  profile.goals.includes(input.goal)?"A equipe da loja cadastrou esta opção para "+goalNames[input.goal]+".":null,
  profile.hair.includes(input.hair)?"Indicado no cadastro para o seu tipo de cabelo.":null,
  profile.chemistry.includes(input.chemistry)?"O cadastro inclui a condição de química ou coloração que você informou.":null,
  stageReasons[step],
  goalMatch?'Na sua busca por '+goalNames[input.goal]+', encontramos esta opção entre os produtos da loja.':'Esta opção completa a etapa e cabe no seu orçamento. Veja as indicações do produto para conferir se atende ao cuidado que você procura.',
  !profile.hair.length&&hairMatch?(curly?'Uma opção da linha de cachos para você conhecer.':straight?'Uma opção da linha para cabelos lisos para você conhecer.':'Uma opção da linha para cabelos ondulados para você conhecer.'):null,
  profile.chemistry.length?null:treated||natural?'As informações do produto mencionam fios '+(treated?'com química ou coloração.':'sem química.'):(input.chemistry==='treated'?'Fez química ou coloração? Confira a indicação no rótulo ou peça ajuda à nossa equipe antes de escolher.':null)
 ].filter(Boolean);
 return {step,goalStrength,score:goalStrength*4+Number(hairMatch)*2+Number(profile.chemistry.includes(input.chemistry))*2+Number(treated||natural),evidence};
}
function automaticCandidates(available,config,input){
 const rows=[];
 for(const found of available.values()){
  const sku=String(found.product.sku).trim().toLowerCase();
  const rules=(Array.isArray(config.rules)?config.rules:[]).slice(0,30).filter(r=>String(r.sku).trim().toLowerCase()===sku && r.goal===input.goal);
  if(rules.length&&!rules.some(r=>['all',input.hair].includes(r.hair)&&['all',input.chemistry].includes(r.chemistry)))continue;
  const info=classify(found.product,input);if(!info)continue;
  rows.push({...found,curated:0,specificity:info.score,automatic:true,evidence:info.evidence,
   rule:{sku,step:info.step,reason:stageReasons[info.step]}});
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
