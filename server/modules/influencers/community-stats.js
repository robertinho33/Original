'use strict';
// Totals survive removal of a photo; friendship counts include only active links.
async function communityStats(db,owner){
 const [parent,count]=await Promise.all([db.collection('influencerCommunities').doc(owner).get(),db.collection('influencerCommunities').doc(owner).collection('followers').where('active','==',true).count().get()]);
 const totals=parent.exists?parent.data().reactionTotals||{}:{};
 return {friends:count.data().count,likes:Math.max(0,Number(totals.likes)||0),wants:Math.max(0,Number(totals.wants)||0)};
}
module.exports={communityStats};
