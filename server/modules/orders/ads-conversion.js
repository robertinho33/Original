'use strict';
const {createHash}=require('node:crypto');
// Only authoritative production payments, never the tracking projection or redirect.
function purchaseMeasurement(id,order,now=Date.now()) {
 const payment=order?.payment;
 const confirmed=Date.parse(payment?.confirmedAt);
 const value=order?.totals?.total;
 if (!id || payment?.provider!=='infinitepay' || payment.mode!=='production' || payment.status!=='paid' ||
     !payment.paymentId || payment.reviewRequired || order.test===true || order.isTest===true ||
     /cancel|refund/i.test(order.status||'') || !Number.isFinite(confirmed) || confirmed>now || now-confirmed>30*86400000 ||
     typeof value!=='number' || !Number.isFinite(value) || value<=0) return null;
 return {transaction_id:createHash('sha256').update('ads-purchase:'+id).digest('hex'),
   value:Math.round(value*100)/100,currency:'BRL'};
}
module.exports={purchaseMeasurement};
