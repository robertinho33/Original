'use strict';
function createCachedRead(load, ttlMs, now=Date.now) {
  let value, expires=0, pending=null, generation=0;
  function invalidate(){generation++;expires=0;value=undefined;pending=null;}
  function get(){
    if(value!==undefined&&now()<expires)return Promise.resolve(value);
    if(pending)return pending.promise;
    const request={generation};
    request.promise=Promise.resolve().then(load).then(result=>{
      if(request.generation===generation){value=result;expires=now()+ttlMs;}
      return result;
    }).finally(()=>{if(pending===request)pending=null;});
    pending=request;return request.promise;
  }
  return {get,invalidate};
}
module.exports={createCachedRead};
