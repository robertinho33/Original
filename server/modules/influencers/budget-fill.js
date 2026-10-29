'use strict';
// Keep the main kit fixed; consider each distinct individual product by descending price.
function fillBudget(rows,capacity){
 const candidates=[...new Map(rows.filter(row=>Number.isSafeInteger(row.cents)&&row.cents>0&&row.cents<=capacity).map(row=>[String(row.product.sku),row])).values()].sort((a,b)=>b.cents-a.cents||String(a.product.sku).localeCompare(String(b.product.sku)));
 const selected=[];let cents=0;
 for(const row of candidates){if(cents+row.cents>capacity)continue;selected.push(row);cents+=row.cents;}
 return {rows:selected,cents};
}
module.exports={fillBudget};
