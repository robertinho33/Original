'use strict';
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
function dateValue(value){
  if(value&&typeof value.toDate==='function')value=value.toDate();
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))value+='T12:00:00-03:00';
  if(value===null||value===undefined||value==='')return null;
  const date=value instanceof Date?value:new Date(value);return Number.isFinite(date.getTime())?date:null;
}
function day(value){const date=dateValue(value);return date?formatter.format(date):'';}
function range(days=1,now=new Date()){
  const count=Number.isFinite(Number(days))?Math.min(365,Math.max(1,Math.floor(Number(days)))):30;
  const start=new Date(day(now)+'T00:00:00-03:00');start.setUTCDate(start.getUTCDate()-count+1);
  const end=new Date(day(now)+'T00:00:00-03:00');end.setUTCDate(end.getUTCDate()+1);
  return {start,end};
}
function inRange(order,bounds){const date=dateValue(order.createdAt);return !!date&&date>=bounds.start&&date<bounds.end;}
const status=order=>normalize(order.payment?.status??order.paymentStatus);
const isPaid=order=>['paid','approved','pago','aprovado'].includes(status(order));
function orderTotal(order){const value=Number(order.totals?.total??order.total??0);return Number.isFinite(value)&&value>=0?value:0;}
const revenue=orders=>orders.filter(isPaid).reduce((sum,order)=>sum+Math.round(orderTotal(order)*100),0)/100;
async function ordersBetween(collection,bounds){
  // Query both historical ISO strings and Firestore timestamps. Padding admits
  // ISO strings with explicit offsets; the exact business-day filter runs below.
  const stringStart=new Date(bounds.start.getTime()-86400000).toISOString(),stringEnd=new Date(bounds.end.getTime()+86400000).toISOString();
  const snapshots=await Promise.all([[bounds.start,bounds.end],[stringStart,stringEnd]].map(([start,end])=>collection.where('createdAt','>=',start).where('createdAt','<',end).get()));
  const rows=new Map();for(const snapshot of snapshots)for(const doc of snapshot.docs)rows.set(doc.id,{...doc.data(),id:doc.id});
  return [...rows.values()].filter(order=>inRange(order,bounds));
}
function timeline(orders,bounds){
  const grouped=new Map();
  for(const order of orders){if(!isPaid(order)||!inRange(order,bounds))continue;const key=day(order.createdAt),row=grouped.get(key)||{date:key,orders:0,cents:0};row.orders++;row.cents+=Math.round(orderTotal(order)*100);grouped.set(key,row);}
  return [...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(({cents,...row})=>({...row,revenue:cents/100}));
}
async function readPaidOrders(collection){
  const values=['paid','approved','pago','aprovado','Pago'];
  const snapshots=await Promise.all(['payment.status','paymentStatus'].map(field=>collection.where(field,'in',values).select('payment.status','paymentStatus','logistics.status','logisticsStatus','status').get()));
  const rows=new Map();for(const snapshot of snapshots)for(const doc of snapshot.docs)rows.set(doc.id,{...doc.data(),id:doc.id});return [...rows.values()].filter(isPaid);
}
function pendingShipments(orders){
  const closed=new Set(['delivered','completed','cancelled','canceled','entregue','concluido']);
  return orders.filter(order=>{if(!isPaid(order)||['cancelled','canceled'].includes(normalize(order.status)))return false;const shipping=normalize(order.logistics?.status??order.logisticsStatus??order.status);return !!shipping&&!closed.has(shipping);}).length;
}
module.exports={dateValue,day,range,inRange,isPaid,orderTotal,revenue,ordersBetween,timeline,readPaidOrders,pendingShipments};
