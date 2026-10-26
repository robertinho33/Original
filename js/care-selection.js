// Keep the same SKU/quantity contract used by the store bag and checkout.
export function mergeCareCart(current,items){
 const rows=new Map();
 for(const row of Array.isArray(current)?current:[]){
  if(typeof row?.sku!=='string'||!row.sku.trim()||!Number.isSafeInteger(row.quantity)||row.quantity<1)continue;
  const sku=row.sku.trim();rows.set(sku,{sku,quantity:Math.min(999,(rows.get(sku)?.quantity||0)+row.quantity)});
 }
 for(const item of items){
  const sku=typeof item?.sku==='string'?item.sku.trim():'';if(!sku)continue;
  const row=rows.get(sku)||{sku,quantity:0};row.quantity=Math.min(999,row.quantity+1);rows.set(sku,row);
 }
 return [...rows.values()];
}
export function cleanMatchReasons(value){
 return [...new Set((Array.isArray(value)?value:[]).filter(v=>typeof v==='string').map(v=>v.trim()).filter(v=>v&&!/^[-–—•\s]+$/.test(v)))];
}
