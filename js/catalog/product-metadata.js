(function(root){
'use strict';
const columns=['source_id','brand','line','product_category','product_subcategory','product_type','care_step','hair_types','hair_scope','chemistry_types','chemistry_scope','care_goals','primary_goal','care_restrictions','kit_components','kit_review_status','care_review_status','care_source','care_notes'];
const evidenceColumns=['care_usage','care_evidence_status','care_verified_at'];
const options={hair:['straight','wavy','curly','coily'],chemistry:['natural','treated'],goals:['hydration','repair','frizz','curls','color','nutrition','oiliness'],type:['individual','kit'],step:['wash','condition','treat','finish','scalp','accessory','kit'],status:['pending','approved','excluded'],scope:['unknown','selected','all']};
const text=value=>String(value??'').trim();
function choice(value,allowed,label,fallback=''){const v=text(value)||fallback;if(v&&!allowed.includes(v))throw Error(label+': valor inválido ('+v+').');return v;}
function list(value,allowed,label){const values=text(value)?text(value).split('|').map(text):[];if(values.some(v=>!v||!allowed.includes(v)))throw Error(label+': use valores separados por |.');if(new Set(values).size!==values.length)throw Error(label+': valor repetido.');return values;}
function scope(value,values,allowed,label){const mode=choice(value,options.scope,label,values.length?'selected':'unknown');if(mode==='unknown'&&values.length)throw Error(label+': há indicações preenchidas com escopo desconhecido.');if(mode==='selected'&&!values.length)throw Error(label+': selecione pelo menos uma indicação.');if(mode==='all'&&values.length&&allowed.some(v=>!values.includes(v)))throw Error(label+': todos exige a lista completa ou vazia.');return {mode,values:mode==='all'?[...allowed]:values};}
function parseMetadata(row){
 if(!columns.some(column=>Object.hasOwn(row,column)))return null;
 const hair=scope(row.hair_scope,list(row.hair_types,options.hair,'hair_types'),options.hair,'hair_scope');
 const chemistry=scope(row.chemistry_scope,list(row.chemistry_types,options.chemistry,'chemistry_types'),options.chemistry,'chemistry_scope');
 const goals=list(row.care_goals,options.goals,'care_goals'),primaryGoal=choice(row.primary_goal,options.goals,'primary_goal');
 if(primaryGoal&&!goals.includes(primaryGoal))throw Error('primary_goal deve estar em care_goals.');
 const components=[];for(const entry of text(row.kit_components)?text(row.kit_components).split('|'):[]){const match=entry.match(/^([^\s|:/]+):(\d+)$/);if(!match||Number(match[2])<1||Number(match[2])>999)throw Error('kit_components: use SKU:quantidade separados por |.');if(match[1].toLowerCase()===text(row.sku).toLowerCase()||components.some(c=>c.sku.toLowerCase()===match[1].toLowerCase()))throw Error('kit_components: componente repetido ou o próprio kit.');components.push({sku:match[1],quantity:Number(match[2])});}
 const sourceId=text(row.source_id);if(sourceId&&!/^[a-z0-9][a-z0-9-]{0,47}$/.test(sourceId))throw Error('source_id inválido.');
 const result={schemaVersion:2,sourceId,brand:text(row.brand),line:text(row.line),category:text(row.product_category),subcategory:text(row.product_subcategory),type:choice(row.product_type,options.type,'product_type'),step:choice(row.care_step,options.step,'care_step'),hairScope:hair.mode,chemistryScope:chemistry.mode,hair:hair.values,chemistry:chemistry.values,goals,primaryGoal,restrictions:text(row.care_restrictions).split('|').map(text).filter(Boolean),components,kitReviewStatus:choice(row.kit_review_status,options.status,'kit_review_status','pending'),reviewStatus:choice(row.care_review_status,options.status,'care_review_status','pending'),source:text(row.care_source),notes:text(row.care_notes)};
 if(result.type==='individual'&&(components.length||result.step==='kit'))throw Error('Produto individual não pode conter componentes nem etapa kit.');
 if(result.type==='kit'&&result.step&&result.step!=='kit')throw Error('Kit deve usar care_step=kit.');
 if(result.kitReviewStatus==='approved'&&(result.type!=='kit'||!components.length))throw Error('Composição aprovada exige um kit com componentes.');
 if(evidenceColumns.some(column=>Object.hasOwn(row,column))){
  result.schemaVersion=3;result.usage=choice(row.care_usage,['home','professional','unknown'],'care_usage','unknown');
  result.evidenceStatus=choice(row.care_evidence_status,['purpose_verified','unverified'],'care_evidence_status','unverified');result.verifiedAt=text(row.care_verified_at);
  if(result.evidenceStatus==='purpose_verified'){
   let official=false;try{const url=new URL(result.source);official=url.protocol==='https:'&&['www.grupoecobelle.com.br','grupoecobelle.com.br'].includes(url.hostname)&&url.pathname.endsWith('/p');}catch{}
   if(result.sourceId!=='ecobelle'||!official||!/^\d{4}-\d{2}-\d{2}$/.test(result.verifiedAt)||Number.isNaN(Date.parse(result.verifiedAt)))throw Error('Finalidade verificada exige fonte oficial EcoBelle e data da revisão.');
  }
 }
 const verifiedPurpose=result.evidenceStatus==='purpose_verified'&&result.usage==='home';
 if(result.reviewStatus==='approved'&&(!result.brand||!result.category||!result.subcategory||!result.type||!result.step||(!verifiedPurpose&&(hair.mode==='unknown'||chemistry.mode==='unknown'))||!primaryGoal||!result.source))throw Error('Aprovação exige marca, categoria, subcategoria, tipo, etapa, indicações, objetivo principal e fonte.');
 if(result.reviewStatus==='approved'&&result.type==='kit'&&result.kitReviewStatus!=='approved')throw Error('Kit aprovado exige composição aprovada.');
 return result;
}
function validateReferences(entries,skus){for(const {sku,metadata} of entries)for(const component of metadata?.components||[])if(!skus.has(component.sku.toLowerCase()))throw Error('Kit '+sku+': componente não encontrado ('+component.sku+').');}
function importPatch(metadata,existing={}){
 if(!metadata)return {};
 if(existing.catalogProfile?.reviewStatus==='approved'&&metadata.reviewStatus!=='approved')return {};
 const patch={catalogProfile:metadata};
 if(metadata.sourceId)patch.sourceId=metadata.sourceId;
 if(metadata.reviewStatus==='approved')patch.careProfile={hair:metadata.hair,chemistry:metadata.chemistry,goals:metadata.goals};
 if(metadata.kitReviewStatus==='approved'){patch.kitComponents=metadata.components;patch.kitReviewStatus='approved';}
 return patch;
}
const api={columns,evidenceColumns,options,parseMetadata,validateReferences,importPatch};root.ProductMetadata=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
