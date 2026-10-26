(function(root){
'use strict';
const text=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
function phone(value){let digits=String(value||'').replace(/\D/g,'');if(digits.length>=12&&digits.startsWith('55'))digits=digits.slice(2);return digits;}
function identityKeys(row){
 const name=text(row.name),email=String(row.email||'').trim().toLowerCase(),number=phone(row.phone),keys=[];
 if(email)keys.push('email:'+email);
 if(name&&number)keys.push('person:'+name+'|'+number);
 if(name&&!email&&!number)keys.push('name:'+name);
 return keys;
}
function introducedDuplicate(rows,next,current=null){
 const previous=new Set(current?identityKeys(current):[]),keys=identityKeys(next).filter(key=>!previous.has(key));
 return rows.find(row=>String(row.id)!==String(current?.id)&&identityKeys(row).some(key=>keys.includes(key)))||null;
}
function duplicateIds(rows){const owners=new Map(),ids=new Set();for(const row of rows)for(const key of identityKeys(row)){if(owners.has(key)){ids.add(owners.get(key));ids.add(String(row.id));}else owners.set(key,String(row.id));}return ids;}
function filterInfluencers(rows,{query='',status='all',access='all',duplicates=false}={}){
 const words=text(query).split(' ').filter(Boolean),ids=duplicates?duplicateIds(rows):null;
 return rows.filter(row=>{
  const haystack=text([row.name,row.email,row.phone,phone(row.phone),row.pixKey].join(' '));
  return words.every(word=>haystack.includes(word))&&(status==='all'||(row.active!==false)===(status==='active'))&&(access==='all'||(row.portalEnabled===true)===(access==='enabled'))&&(!ids||ids.has(String(row.id)));
 });
}
const api={identityKeys,introducedDuplicate,duplicateIds,filterInfluencers};
if(typeof module==='object'&&module.exports)module.exports=api;else root.InfluencerIdentity=api;
})(globalThis);
