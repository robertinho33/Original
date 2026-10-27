'use strict';
const {randomBytes}=require('node:crypto');
const keys=['followers','gallery','sharing'];
class RolloutError extends Error{constructor(status,message){super(message);this.status=status;}}
const empty=()=>Object.fromEntries(keys.map(key=>[key,false]));
const revision=data=>typeof data?.revision==='string'?data.revision:'';
function globals(data={}){return {enabled:data.enabled===true,defaults:Object.fromEntries(keys.map(key=>[key,data.defaults?.[key]===true])),revision:revision(data)};}
function overrides(data={}){return {...Object.fromEntries(keys.map(key=>[key,typeof data[key]==='boolean'?data[key]:'inherit'])),revision:revision(data)};}
function effective(global,individual){return Object.fromEntries(keys.map(key=>[key,global.enabled&&(typeof individual[key]==='boolean'?individual[key]:global.defaults[key])]));}
function refs(db,owner){return {global:db.collection('settings').doc('influencerFeatureRollout'),individual:owner?db.collection('influencerFeatureAccess').doc(owner):null};}
async function getAccess(db,owner,reader){
 const target=refs(db,owner),read=ref=>reader?reader.get(ref):ref.get(),globalDoc=await read(target.global),global=globals(globalDoc.exists?globalDoc.data():{});
 if(!global.enabled)return empty();
 const individualDoc=await read(target.individual);return effective(global,overrides(individualDoc.exists?individualDoc.data():{}));
}
async function getSettings(db,owner){
 if(owner&&!/^[\w-]{1,100}$/.test(owner))throw new RolloutError(400,'Influenciador inválido.');
 const target=refs(db,owner),globalDoc=await target.global.get(),global=globals(globalDoc.exists?globalDoc.data():{});
 if(!owner)return global;
 const [person,doc]=await Promise.all([db.collection('influencers').doc(owner).get(),target.individual.get()]);
 if(!person.exists)throw new RolloutError(404,'Influenciador não encontrado.');
 const individual=overrides(doc.exists?doc.data():{});
 return {global,individual,effective:effective(global,individual)};
}
function validate(body,owner){
 if(!body||Array.isArray(body)||typeof body.revision!=='string'||body.revision.length>100||Object.keys(body).some(key=>!(owner?['revision',...keys]:['revision','enabled','defaults']).includes(key)))throw new RolloutError(400,'Confira os controles da atualização.');
 if(owner){if(keys.some(key=>typeof body[key]!=='boolean'&&body[key]!=='inherit'))throw new RolloutError(400,'Escolha seguir o padrão, liberar ou bloquear para cada recurso.');}
 else if(typeof body.enabled!=='boolean'||!body.defaults||Array.isArray(body.defaults)||Object.keys(body.defaults).some(key=>!keys.includes(key))||keys.some(key=>typeof body.defaults[key]!=='boolean'))throw new RolloutError(400,'Confira a chave geral e o padrão coletivo.');
}
async function saveSettings(db,owner,body,actor){
 validate(body,owner);if(owner&&!/^[\w-]{1,100}$/.test(owner))throw new RolloutError(400,'Influenciador inválido.');
 const target=refs(db,owner),ref=owner?target.individual:target.global;
 await db.runTransaction(async tx=>{
  const doc=await tx.get(ref);if(revision(doc.exists?doc.data():{})!==body.revision)throw new RolloutError(409,'As permissões mudaram em outra tela. Feche e abra novamente antes de salvar.');
  if(owner){const person=await tx.get(db.collection('influencers').doc(owner));if(!person.exists)throw new RolloutError(404,'Influenciador não encontrado.');}
  const data=owner?Object.fromEntries(keys.map(key=>[key,body[key]])):{enabled:body.enabled,defaults:body.defaults};
  tx.set(ref,{...data,revision:randomBytes(16).toString('hex'),updatedAt:new Date().toISOString(),updatedBy:actor});
 });
 return getSettings(db,owner);
}
module.exports={keys,RolloutError,getAccess,getSettings,saveSettings};
