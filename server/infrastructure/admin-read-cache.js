'use strict';
const isQuotaError=error=>Number(error?.code)===8||['resource-exhausted','RESOURCE_EXHAUSTED'].includes(error?.code)||/RESOURCE_EXHAUSTED|Quota exceeded/i.test(String(error?.message||''));
const quotaMessage='O limite de consultas do banco de dados foi atingido. Os indicadores voltarão quando a cota estiver disponível. Atualizar repetidamente não resolve esse limite.';
// Administrative reads only: successful snapshots are short-lived; quota failures
// are held briefly to avoid hammering an exhausted database. No fabricated zeroes.
function createAdminReadCache(load,ttlMs=60000,now=Date.now){
 let value,until=0,pending=null,failure=null,retryAt=0;
 async function get(){
  if(value!==undefined&&now()<until)return value;
  if(failure&&now()<retryAt)throw failure;
  if(pending)return pending;
  pending=Promise.resolve().then(load).then(result=>{value=result;until=now()+ttlMs;failure=null;return result;},error=>{if(isQuotaError(error)){failure=error;retryAt=now()+30000;}throw error;}).finally(()=>{pending=null;});
  return pending;
 }
 return {get};
}
module.exports={createAdminReadCache,isQuotaError,quotaMessage};
