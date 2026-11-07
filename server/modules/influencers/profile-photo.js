'use strict';
const {createHash}=require('node:crypto');
const snapshots=require('../../config/profile-photo-cache.json');
const origin='https://www.fiosperfeitos.com.br';
const ownerValid=value=>typeof value==='string'&&/^[\w-]{1,100}$/.test(value);
const hash=value=>createHash('sha256').update(value).digest('hex');
const inflight=new Map(),failures=new Map();
function instagramProfile(value){
 try{const url=new URL(value),parts=url.pathname.split('/').filter(Boolean);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['instagram.com','www.instagram.com'].includes(url.hostname)||parts.length!==1||!/^[\w.]{1,30}$/.test(parts[0])||['accounts','p','reel','reels','stories','explore','direct'].includes(parts[0].toLowerCase()))return '';
  return 'https://www.instagram.com/'+parts[0]+'/';
 }catch{return '';}
}
function instagramImage(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname.endsWith('.cdninstagram.com')||url.hostname.endsWith('.fbcdn.net'));}catch{return false;}}
function photoUrl(owner,version){return origin+'/api/discovery/profile-photo/'+encodeURIComponent(owner)+'?v='+version;}
function ownPhotoUrl(owner,value){try{const url=new URL(value);return ['https://www.fiosperfeitos.com.br','https://fiosperfeitos.com.br'].includes(url.origin)&&url.pathname==='/api/discovery/profile-photo/'+owner;}catch{return false;}}
function profilePhoto(owner,value){
 const current=String(value||'');if(!current||!ownerValid(owner))return current;
 const profile=instagramProfile(current);if(profile&&snapshots[profile])return snapshots[profile];
 if(instagramImage(current)){const filename=new URL(current).pathname.split('/').pop();if(snapshots[filename])return snapshots[filename];}
 return instagramProfile(current)||instagramImage(current)?photoUrl(owner,hash(current).slice(0,20)):current;
}
async function remote(value,kind,fetchImpl=fetch){
 let url=value;
 for(let redirects=0;redirects<4;redirects++){
  if(kind==='image'?!instagramImage(url):!instagramProfile(url))throw Error('Use um perfil público do Instagram ou envie o arquivo da foto.');
  const response=await fetchImpl(url,{redirect:'manual',headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
  if([301,302,303,307,308].includes(response.status)){url=new URL(response.headers.get('location'),url).href;continue;}
  if(!response.ok)throw Error('O Instagram não liberou esta imagem. Envie o arquivo da foto para mantê-la na loja.');
  const type=response.headers.get('content-type')||'';
  if(kind==='image'?!/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(type):!type.includes('text/html'))throw Error('O endereço não retornou uma foto válida. Envie a imagem pelo aparelho.');
  const maximum=kind==='image'?2000000:3000000;
  if(Number(response.headers.get('content-length'))>maximum)throw Error('Arquivo muito grande. Envie uma foto menor.');
  const chunks=[];let length=0;const reader=response.body.getReader();
  try{for(;;){const {done,value:chunk}=await reader.read();if(done)break;length+=chunk.byteLength;if(length>maximum){await reader.cancel();throw Error('Arquivo muito grande. Envie uma foto menor.');}chunks.push(Buffer.from(chunk));}}finally{reader.releaseLock();}
  return Buffer.concat(chunks);
 }
 throw Error('Não foi possível abrir a foto. Envie o arquivo pelo aparelho.');
}
function sharedImage(html){
 for(const meta of html.match(/<meta\b[^>]*>/gi)||[]){
  const attrs={};for(const match of meta.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs))attrs[match[1].toLowerCase()]=match[3];
  if((attrs.property||attrs.name)==='og:image')return String(attrs.content||'').replace(/&amp;/g,'&').replace(/&#38;/g,'&').replace(/&quot;/g,'"');
 }
 return '';
}
async function normalizePhoto(bytes){
 try{const sharp=require('sharp'),metadata=await sharp(bytes,{limitInputPixels:12000000,animated:false}).metadata();
  if(!['jpeg','png','webp'].includes(metadata.format)||metadata.pages>1)throw Error();
  const output=await sharp(bytes,{limitInputPixels:12000000}).rotate().resize(240,240,{fit:'cover',withoutEnlargement:true}).webp({quality:82}).toBuffer();
  if(output.length>180000)throw Error();return output;
 }catch{throw Error('Não foi possível validar a foto. Use JPG, PNG ou WebP de até 1 MB.');}
}
async function preparePhoto(owner,value,{fetchImpl=fetch}={}){
 if(!ownerValid(owner))throw Error('Influenciador inválido.');
 const input=String(value||'').trim();let bytes;
 if(instagramImage(input)){const cached=snapshots[new URL(input).pathname.split('/').pop()];if(cached)return {image:cached};}
 if(input.startsWith('data:')){
  if(input.length>1500000||!/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(input))throw Error('Envie uma foto JPG, PNG ou WebP de até 1 MB.');
  bytes=Buffer.from(input.split(',')[1],'base64');if(bytes.length>1000000)throw Error('Envie uma foto de até 1 MB.');
 }else if(instagramProfile(input)){
  const image=sharedImage((await remote(instagramProfile(input),'html',fetchImpl)).toString('utf8'));
  if(!image)throw Error('O Instagram não disponibilizou a foto pública. Envie a imagem pelo aparelho.');
  bytes=await remote(image,'image',fetchImpl);
 }else if(instagramImage(input))bytes=await remote(input,'image',fetchImpl);
 else return {image:input};
 bytes=await normalizePhoto(bytes);const version=hash(bytes).slice(0,24);
 return {image:photoUrl(owner,version),photo:{bytes,source:photoUrl(owner,version),contentType:'image/webp',updatedAt:new Date().toISOString()}};
}
function createPhotoHandler({getDb,fetchImpl=fetch}){
 return async(req,res)=>{
  const owner=req.params.id;if(!ownerValid(owner))return res.status(404).end();
  try{
   const db=getDb(),ref=db.collection('influencerPublicStores').doc(owner),photoRef=db.collection('influencerProfilePhotos').doc(owner);
   const [store,person,saved]=await Promise.all([ref.get(),db.collection('influencers').doc(owner).get(),photoRef.get()]);
   if(!store.exists||!store.data().enabled||!person.exists||person.data().active===false)return res.status(404).end();
   const source=String(store.data().image||'');let photo=saved.exists?saved.data():null;
   if(!source)return res.status(404).end();
   if(!photo?.bytes||photo.source!==source){
    if(ownPhotoUrl(owner,source)||(!instagramProfile(source)&&!instagramImage(source)))return res.status(404).end();
    const key=owner+':'+hash(source);if(failures.get(key)>Date.now())return res.status(503).end();
    if(!inflight.has(key)){
     if(inflight.size>=4)return res.status(503).end();
     const operation=(async()=>{const prepared=await preparePhoto(owner,source,{fetchImpl});if(!prepared.photo)throw Error('Foto indisponível.');const record={...prepared.photo,source};
      await db.runTransaction(async tx=>{const current=await tx.get(ref);if(!current.exists||current.data().image!==source)throw Error('Foto atualizada.');tx.set(photoRef,record);});return record;
     })().catch(error=>{if(failures.size>100)failures.clear();failures.set(key,Date.now()+30000);throw error;}).finally(()=>inflight.delete(key));inflight.set(key,operation);
    }
    photo=await inflight.get(key);
   }
   res.set({'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}).type('image/webp').send(Buffer.from(photo.bytes));
  }catch{res.status(503).end();}
 };
}
module.exports={profilePhoto,preparePhoto,createPhotoHandler,instagramProfile,instagramImage,sharedImage};
