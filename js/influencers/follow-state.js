const prefix='fp-follow-';
export function readFollow(owner){
 try{const row=JSON.parse(localStorage.getItem(prefix+owner)||'null');return /^[a-f0-9]{32}$/.test(row?.id||'')&&/^[a-f0-9]{64}$/.test(row?.secret||'')?row:null;}catch{return null;}
}
export function saveFollow(owner,value){
 let persisted=true;try{if(value)localStorage.setItem(prefix+owner,JSON.stringify(value));else localStorage.removeItem(prefix+owner);}catch{persisted=false;}
 window.dispatchEvent(new CustomEvent('fp-follow-change',{detail:{owner}}));return persisted;
}
const pending=new Map();
export async function verifyFollow(owner){
 const saved=readFollow(owner);if(!saved)return null;
 const key=owner+':'+saved.id;
 if(pending.has(key))return pending.get(key);
 const operation=(async()=>{
  const response=await fetch('/api/community/follow/'+encodeURIComponent(saved.id)+'/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:saved.secret}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if([401,404].includes(response.status)){const current=readFollow(owner);if(current?.id===saved.id&&current.secret===saved.secret)saveFollow(owner,null);return 'inactive';}
  if(!response.ok||!result.success)throw Error('Não foi possível conferir o acompanhamento.');
  const status=result.data.status,current=readFollow(owner);
  if(current?.id===saved.id&&current.secret===saved.secret){
   if(['confirmed','pending','blocked'].includes(status)){if(current.status!==status)saveFollow(owner,{...saved,status});}
   else saveFollow(owner,null);
  }
  return status;
 })().finally(()=>pending.delete(key));pending.set(key,operation);return operation;
}
export function watchFollows(callback){
 const storage=event=>{if(event.key===null||event.key.startsWith(prefix))callback();};
 window.addEventListener('storage',storage);window.addEventListener('fp-follow-change',callback);
 window.addEventListener('pageshow',callback);
 return ()=>{window.removeEventListener('storage',storage);window.removeEventListener('fp-follow-change',callback);window.removeEventListener('pageshow',callback);};
}
