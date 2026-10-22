import {installProductImageFallbacks} from './catalog/image-fallback.js';
installProductImageFallbacks();
const form=document.getElementById('productBuyForm');
form?.addEventListener('submit',event=>{
  event.preventDefault();
  const message=document.getElementById('productBuyMessage');
  const quantity=Number(document.getElementById('productQuantity').value),stock=Number(form.dataset.stock),sku=form.dataset.sku;
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>stock){message.textContent='Confira a quantidade disponível.';return;}
  try{
    const saved=JSON.parse(localStorage.getItem('aurea-cart')||'[]');
    const cart=(Array.isArray(saved)?saved:[]).filter(row=>typeof row?.sku==='string'&&Number.isSafeInteger(row.quantity)&&row.quantity>0).map(row=>({sku:row.sku,quantity:row.quantity}));
    const item=cart.find(row=>row.sku===sku),total=(item?.quantity||0)+quantity;
    if(!Number.isSafeInteger(total)||total>stock){message.textContent='A quantidade, somada à sua sacola, supera o estoque disponível.';return;}
    if(item)item.quantity=total;else cart.push({sku,quantity});
    localStorage.setItem('aurea-cart',JSON.stringify(cart));
    const coupon=new URLSearchParams(location.search).get('cupom')||'';
    location.assign('/pages/checkout.html'+(coupon?'?cupom='+encodeURIComponent(coupon):''));
  }catch{message.textContent='Não foi possível salvar a sacola neste aparelho. Abra a loja ou fale com nosso atendimento.';}
});
