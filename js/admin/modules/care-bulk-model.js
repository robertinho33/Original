import '../../product-care-profile.js';
const {normalize,options}=globalThis.ProductCareProfile;
const searchKey=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function careSupplier(product,sources=[]){
 const id=searchKey(product.sourceId||product.source_id||product.supplierId||product.supplier_id);
 const source=sources.find(s=>searchKey(s.id)===id);
 const name=String(source?.name||product.supplierName||product.sourceName||product.source_name||'').trim();
 return {id:id?'id:'+id:name?'name:'+searchKey(name):'unassigned',name:name||id||'Sem fornecedor'};
}
export function filterCareProducts(products,{query='',supplier='',scope='all'}={},model,sources=[]){
 const words=searchKey(query).split(/\s+/).filter(Boolean);
 return products.filter(p=>{
  const vendor=careSupplier(p,sources),id=productId(p);
  return (!supplier||vendor.id===supplier)&&words.every(word=>searchKey([p.name,p.sku,p.brand,p.sourceName,vendor.name].join(' ')).includes(word))
   &&(scope==='all'||scope==='changed'&&model.drafts.has(id)||scope==='pending'&&(p.catalogProfile?p.catalogProfile.reviewStatus!=='approved':Object.values(model.profile(id)).some(values=>!values.length)));
 });
}
export const productId=p=>String(p.id||p.productId||p.docId||'');
export const canonical=value=>Object.fromEntries(Object.entries(options).map(([field,choices])=>[field,Object.keys(choices).filter(key=>normalize(value)[field].includes(key))]));
export const equalProfiles=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function createCareDrafts(products){
 const byId=new Map(products.map(p=>[productId(p),p]).filter(([id])=>id));const drafts=new Map();
 return {drafts,profile:id=>canonical(drafts.get(id)??globalThis.ProductCareProfile.forProduct(byId.get(id))),
  set(id,value){if(!byId.has(id))throw Error('Produto não identificado.');const profile=canonical(value);if(equalProfiles(profile,byId.get(id).careProfile))drafts.delete(id);else drafts.set(id,profile);},
  changes:()=>[...drafts].map(([id,careProfile])=>({id,careProfile:canonical(careProfile)})),
  commit(changes){for(const change of changes){const p=byId.get(change.id);if(p)p.careProfile=canonical(change.careProfile);drafts.delete(change.id);}},
  discard(){drafts.clear();}
 };
}
export async function persistCareChanges(changes,{writeChunk,onCommitted=()=>{}}){
 if(!Array.isArray(changes))throw Error('Lista de alterações inválida.');
 const seen=new Set();const clean=changes.map(change=>{const id=String(change.id||'');if(!id||id.includes('/')||seen.has(id))throw Error('Identificação de produto inválida ou repetida.');seen.add(id);return {id,careProfile:canonical(change.careProfile)};});
 let saved=0;
 for(let i=0;i<clean.length;i+=400){const chunk=clean.slice(i,i+400);try{await writeChunk(chunk);}catch(cause){const error=Error(saved?'Foram salvos '+saved+' produtos. As demais alterações continuam pendentes. Tente salvar novamente.':'Não foi possível salvar. Suas alterações continuam nesta tela. Confira a conexão e a disponibilidade do banco.');error.savedCount=saved;error.cause=cause;throw error;}saved+=chunk.length;onCommitted(chunk);}
 return {saved};
}
