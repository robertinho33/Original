import '../../product-care-profile.js';
export const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const number=value=>Number.isFinite(Number(value))?Number(value):0;
export function day(value){
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const date=new Date(value?.seconds?value.seconds*1000:value||NaN);
  return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function paymentState(order){
  const values=[order.payment?.status,order.paymentStatus,order.payment_status,order.status].map(normalized);
  if(values.some(v=>['cancelled','canceled','cancelado','cancelada','refunded','reembolsado','estornado','estornada','chargeback','contestado'].includes(v)))return 'cancelled';
  if(values.some(v=>['paid','pago','approved','aprovado','confirmed','confirmado','completed','concluido'].includes(v)))return 'paid';
  return 'pending';
}
export function normalizeOrders(orders){return orders.map(o=>({...o,_id:String(o.id||o.orderDocumentId||''),_number:String(o.orderNumber||o.order_number||o.id||''),_day:day(o.createdAt||o.created_at),_total:number(o.total??o.totals?.total),_payment:paymentState(o),_logistics:normalized(o.logistics?.status||o.logisticsStatus||o.logistics_status||'new'),_tracking:String(o.logistics?.trackingCode||o.trackingCode||o.tracking_code||''),_carrier:String(o.logistics?.carrier||o.carrier||o.shipping?.carrier||'')}));}
export function periodRows(rows,{from='',to='',query='',status='all'}={}){return rows.filter(o=>(!from||o._day&&o._day>=from)&&(!to||o._day&&o._day<=to)&&(!query||normalized([o._number,o.customer?.name,o.customerName,o._tracking].join(' ')).includes(normalized(query)))&&(status==='all'||o._payment===status));}
export function summarizeOrders(rows){
  const paid=rows.filter(o=>o._payment==='paid'),pending=rows.filter(o=>o._payment==='pending'),cancelled=rows.filter(o=>o._payment==='cancelled');
  const cents=list=>list.reduce((sum,o)=>sum+Math.round(o._total*100),0)/100;
  return {orders:rows.length,paid:paid.length,pending:pending.length,cancelled:cancelled.length,revenue:cents(paid),pendingAmount:cents(pending),cancelledAmount:cents(cancelled),ticket:paid.length?cents(paid)/paid.length:0};
}
export function rankSales(rows){
  const grouped=new Map();for(const order of rows.filter(o=>o._payment==='paid'))for(const item of order.items||[]){const sku=String(item.sku||'');const quantity=number(item.quantity);if(!sku||quantity<=0)continue;const row=grouped.get(sku)||{sku,name:String(item.name||item.title||sku),quantity:0};row.quantity+=quantity;grouped.set(sku,row);}
  return [...grouped.values()].sort((a,b)=>b.quantity-a.quantity||a.sku.localeCompare(b.sku));
}
export function catalogRows(products,inventory=[],sources=[]){
  const bySku=new Map(inventory.filter(i=>i.sku||i.id).map(i=>[String(i.sku||i.id),i]));
  const byId=new Map(inventory.filter(i=>i.productId||i.product_id).map(i=>[String(i.productId||i.product_id),i]));
  const sourceNames=new Map(sources.map(source=>[normalized(source.id),source.name]));
  return products.map(raw=>{
    const p={...raw,sku:String(raw.sku||raw.SKU||raw.Sku||''),name:String(raw.name||raw.Nome||raw.nome||raw.title||'Produto')};
    const i=bySku.get(p.sku)||byId.get(String(p.id||p.productId));
    const stock=number(i?.quantity??p.stock??p.Estoque??p.inventory??p.quantity),reserved=number(i?.reserved??0);
    const brand=String(p.sourceName||p.source_name||p.brand||p.marca||p.Marca||p.supplierName||sourceNames.get(normalized(p.sourceId))||p.sourceId||'Sem marca');
    const category=String(p.categoryName||p.category_name||p.category||'Sem categoria');
    return {...p,_physical:stock,_reserved:reserved,_available:Math.max(0,stock-reserved),_brand:brand,_category:category,_search:normalized([p.name,p.sku,brand,category,...Object.entries(globalThis.ProductCareProfile.forProduct(p)).flatMap(([field,values])=>values.map(value=>globalThis.ProductCareProfile.options[field][value]))].join(' '))};
  });
}
export function filterCatalog(rows,{query='',brand='',category='',stock='all',care=''}={}){
  const words=normalized(query).split(/\s+/).filter(Boolean);
  return rows.filter(p=>(!care||(Object.values(globalThis.ProductCareProfile.forProduct(p)).every(v=>v.length>0)?'complete':'pending')===care)&&words.every(word=>(p._search||normalized([p.name,p.title,p.sku,p._brand,p._category].join(' '))).includes(word))&&(!brand||p._brand===brand)&&(!category||p._category===category)&&(stock==='all'||stock==='empty'&&p._available<=0||stock==='low'&&p._available>0&&p._available<=5||stock==='available'&&p._available>0||stock==='hidden'&&p.active===false));
}
export function csvCell(value){const text=String(value??'');return '"'+(/^[\s]*[=+\-@]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';}
