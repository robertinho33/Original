'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {preparePhoto,profilePhoto,createPhotoHandler,instagramProfile}=require('./profile-photo');
const sharp=require('sharp');
async function photo(){return sharp({create:{width:64,height:80,channels:3,background:'#254b38'}}).jpeg().toBuffer();}
function database(){
 const records=new Map();
 const ref=key=>({key,get:async()=>({exists:records.has(key),data:()=>records.get(key)}),set:async value=>records.set(key,value)});
 const db={collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction:async fn=>fn({get:target=>target.get(),set:(target,value)=>records.set(target.key,value)})};
 return {db,records};
}
test('any influencer can upload a validated permanent image; unknown HTTPS URLs remain unchanged',async()=>{
 const uploaded=await preparePhoto('new-influencer','data:image/jpeg;base64,'+(await photo()).toString('base64'));
 assert.match(uploaded.image,/profile-photo\/new-influencer\?v=[a-f0-9]{24}$/);
 assert.equal((await sharp(uploaded.photo.bytes).metadata()).format,'webp');assert.ok(uploaded.photo.bytes.length<180000);
 assert.equal(profilePhoto('new-influencer',uploaded.image),uploaded.image);
 assert.deepEqual(await preparePhoto('new-influencer',''),{image:''});
 assert.deepEqual(await preparePhoto('new-influencer','https://example.test/photo.jpg'),{image:'https://example.test/photo.jpg'});
 await assert.rejects(preparePhoto('new-influencer','data:image/svg+xml;base64,PHN2Zz4='));
 await assert.rejects(preparePhoto('../other','data:image/jpeg;base64,AA=='));
});
test('public Instagram imports validate metadata, host, redirects and actual image bytes',async()=>{
 const bytes=await photo(),calls=[];
 const fetchImpl=async url=>{calls.push(url);return url.includes('www.instagram.com')?new Response('<meta content="https://scontent.cdninstagram.com/photo.jpg?a=1&amp;b=2" property="og:image">',{headers:{'content-type':'text/html'}}):new Response(bytes,{headers:{'content-type':'image/jpeg'}});};
 const uploaded=await preparePhoto('someone','https://instagram.com/someone/',{fetchImpl});
 assert.ok(uploaded.photo.bytes);assert.equal(calls.length,2);assert.match(calls[1],/a=1&b=2$/);
 assert.equal(instagramProfile('https://instagram.com/accounts/login/'),'');
 assert.equal(instagramProfile('https://www.instagram.com.evil.test/user/'),'');
 assert.equal(instagramProfile('https://name:secret@instagram.com/user/'),'');
 let requests=0;
 await assert.rejects(preparePhoto('someone','https://instagram.com/someone/',{fetchImpl:async()=>{requests++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});}}));
 assert.equal(requests,1,'private redirect was never fetched');
 await assert.rejects(preparePhoto('someone','https://instagram.com/someone/',{fetchImpl:async()=>new Response('<meta property="og:image" content="https://127.0.0.1/private">',{headers:{'content-type':'text/html'}})}));
 await assert.rejects(preparePhoto('someone','https://scontent.cdninstagram.com/image.jpg',{fetchImpl:async()=>new Response('<html>not an image</html>',{headers:{'content-type':'image/jpeg'}})}));
});
test('public photo route stores imports once and cannot expose removed, inactive or another profile image',async t=>{
 const {db,records}=database(),source='https://instagram.com/new.person/';let fetches=0;const bytes=await photo();
 records.set('influencers/new',{active:true});records.set('influencerPublicStores/new',{enabled:true,image:source});
 const handler=createPhotoHandler({getDb:()=>db,fetchImpl:async url=>{fetches++;return url.includes('www.instagram.com')?new Response('<meta property="og:image" content="https://scontent.cdninstagram.com/new.jpg">',{headers:{'content-type':'text/html'}}):new Response(bytes,{headers:{'content-type':'image/jpeg'}});}});
 const app=require('express')();app.get('/photos/:id',handler);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});const base='http://127.0.0.1:'+server.address().port;
 let response=await fetch(base+'/photos/new');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');await response.arrayBuffer();
 assert.equal((await fetch(base+'/photos/new')).status,200);assert.equal(fetches,2);assert.equal(records.get('influencerProfilePhotos/new').source,source);
 assert.equal((await fetch(base+'/photos/another')).status,404);
 records.get('influencers/new').active=false;assert.equal((await fetch(base+'/photos/new')).status,404);
 records.get('influencers/new').active=true;records.get('influencerPublicStores/new').image='';assert.equal((await fetch(base+'/photos/new')).status,404);
});
