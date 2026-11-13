'use strict';
// Keep the main kit fixed; consider each distinct individual product by descending price.
function fillBudget(rows,capacity){
 const candidates=[...new Map(rows.filter(row=>Number.isSafeInteger(row.cents)&&row.cents>0&&row.cents<=capacity).map(row=>[String(row.product.sku),row])).values()].sort((a,b)=>b.cents-a.cents||String(a.product.sku).localeCompare(String(b.product.sku)));
 const selected=[];let cents=0;
 for(const row of candidates){if(cents+row.cents>capacity)continue;selected.push(row);cents+=row.cents;}
 return {rows:selected,cents};
}
// Track reachable totals in cents, using each SKU at most once.
function closestBudget(rows,capacity){
 const totals=new Map([[0,[]]]);
 let best=0;
 for(const row of rows){
  for(const [subtotal,selected] of [...totals]){
   const next=subtotal+row.cents;
   if(next>capacity||totals.has(next))continue;
   const combination=[...selected,row];
   if(next===capacity)return {rows:combination,cents:next};
   totals.set(next,combination);
   best=Math.max(best,next);
  }
 }
 return {rows:totals.get(best),cents:best};
}
module.exports={fillBudget,closestBudget};
