const repository=require('../repositories/admin-overview-repository');
const {createAdminReadCache}=require('../../../infrastructure/admin-read-cache');
const {buildOperationalAlerts}=require('./firestore-admin-indicators');
const overview=createAdminReadCache(()=>repository.getAdminOverview());
const timelines=new Map();
function getOverview(){return overview.get();}
function getTimeline(days=30){const count=Math.min(365,Math.max(1,Math.floor(Number(days)||30)));if(!timelines.has(count)){if(timelines.size>=12)timelines.delete(timelines.keys().next().value);timelines.set(count,createAdminReadCache(()=>repository.getSalesTimeline(count)));}return timelines.get(count).get();}
async function getAlerts(){return buildOperationalAlerts(await getOverview());}
module.exports={getOverview,getTimeline,getAlerts};
