'use strict';
const snapshots=require('../../config/profile-photo-snapshots.json');

// Reuse the supplied public photo while its Instagram CDN address expires.
// A later profile edit or explicit removal always takes precedence.
function profilePhoto(owner,value){
  const current=String(value||''),snapshot=snapshots[owner];
  if(!current||!snapshot)return current;
  try{
    const url=new URL(current);
    if(url.protocol==='https:'&&url.hostname.endsWith('.cdninstagram.com')&&url.pathname.split('/').pop()===snapshot.sourceFilename)return snapshot.image;
  }catch{}
  return current;
}
module.exports={profilePhoto};
