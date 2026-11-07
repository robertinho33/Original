'use strict';
const {normalizeStore,validCoupon}=require('./discovery');
const snapshots=require('../../config/profile-photo-cache.json');
function profilePhoto(value) {
  try {
    const url=new URL(value);
    if (url.hostname==='instagram.com'||url.hostname==='www.instagram.com') {
      const profile='https://www.instagram.com/'+url.pathname.split('/').filter(Boolean).join('/')+'/';
      return snapshots[profile]||value;
    }
    if (url.hostname.endsWith('.cdninstagram.com')||url.hostname.endsWith('.fbcdn.net')) {
      return snapshots[url.pathname.split('/').pop()]||value;
    }
  } catch {}
  return value;
}
function safeDirectoryImage(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}

function createDirectory({getDb, getCatalog}) {
  return require('../../infrastructure/cached-read').createCachedRead(async () => {
    const db=getDb(),snapshot=await db.collection('influencerPublicStores').where('enabled','==',true).limit(60).get();
    const catalog=await getCatalog();
    const rows=await Promise.all(snapshot.docs.map(async doc => {
      try {
        const person=await db.collection('influencers').doc(doc.id).get();
        if(!person.exists||person.data().active===false)return null;
        const config=normalizeStore(doc.data()),coupon=await validCoupon(db,config.coupon,doc.id);
        if(!coupon||!config.skus.some(sku=>catalog.some(p=>String(p.sku).toLowerCase()===sku.toLowerCase())))return null;
        return {name:config.name,image:safeDirectoryImage(profilePhoto(config.image)),url:'/pages/vitrine-influenciador.html?loja='+encodeURIComponent(doc.id)};
      } catch {return null;}
    }));
    return rows.filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).slice(0,30);
  },30000).get;
}
module.exports={createDirectory};
