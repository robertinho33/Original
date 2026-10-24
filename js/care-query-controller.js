// Ignore late responses when the visitor changes a previous answer.
export function createCareQueryController({request,start,result,error,finish}){
 let version=0,active=null,lastKey='',lastResult=null;
 return {
  invalidate(){version++;active?.abort();active=null;},
  async query(input){
   const current=++version;active?.abort();active=new AbortController();const controller=active,key=JSON.stringify(input);
   start();
   try{
    const data=key===lastKey && lastResult?lastResult:await request(input,controller.signal);
    if(current!==version)return;
    lastKey=key;lastResult=data;result(data);
   }catch(reason){if(current===version && reason.name!=='AbortError')error(reason);}
   finally{if(current===version){active=null;finish();}}
  }
 };
}
