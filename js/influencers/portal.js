import { installProductImageFallbacks } from '../catalog/image-fallback.js';
installProductImageFallbacks();
const $ = id => document.getElementById(id);
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statuses = { pending:'Aguardando processamento',new:'Pedido recebido',paid:'Pagamento confirmado',preparing:'Em preparação',processing:'Em preparação',packed:'Embalado',shipped:'Enviado',in_transit:'Em transporte',out_for_delivery:'Saiu para entrega',delivered:'Entregue',cancelled:'Cancelado',posted:'Postado' };
const commissionLabels = { paid:'Repassada',pending:'Aguardando repasse',estimated:'Estimada · a conciliar',not_eligible:'Ainda não elegível' };
const dateLabel = value => value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00-03:00' : value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
function render(data) {
  $('portalLogin').hidden = true; $('portalDashboard').hidden = false;
  $('portalGreeting').textContent = 'Olá, ' + data.profile.name.split(' ')[0] + '.';
  const storeLink=$('portalStoreLink'); storeLink.hidden=!data.storeUrl; if(data.storeUrl?.startsWith('/pages/vitrine-influenciador.html?loja=')) storeLink.href=data.storeUrl;
  renderPromotions(data);
  const summary = data.summary;
  $('portalMetrics').innerHTML = [ ['Vendas no período',summary.sales],['Vendas pagas',summary.paidSales],['Valor das vendas pagas',money(summary.revenue)],['Comissões estimadas',money(summary.commissionEstimated)],['Aguardando repasse',money(summary.commissionPending)],['Comissões repassadas',money(summary.commissionPaid)] ].map(([label,value])=>`<article class="metric"><p>${esc(label)}</p><strong>${esc(value)}</strong></article>`).join('');
  $('portalSalesBody').innerHTML = data.orders.length ? data.orders.map(row=>`<tr><td><strong>${esc(row.orderNumber)}</strong><small>${esc(dateLabel(row.createdAt))}</small></td><td>${esc(row.couponCode)}</td><td>${esc(money(row.total))}</td><td><span class="status-pill ${row.paymentStatus==='Pago'?'paid':''}">${esc(row.paymentStatus)}</span></td><td>${esc(money(row.commission))}<small>${esc(commissionLabels[row.commissionStatus] || 'A conferir')}${row.commissionRate ? ' · '+esc(row.commissionRate)+'%' : ''}</small></td><td>${esc(statuses[row.logisticsStatus] || 'Em acompanhamento')}<small>${esc(row.carrier)} ${esc(row.trackingCode)}</small></td></tr>`).join('') : '<tr><td class="empty-row" colspan="6">Nenhuma venda vinculada a você neste período.</td></tr>';
  $('portalCommissionNote').textContent = data.note + (data.truncated ? ' Exibindo as 200 vendas mais recentes; os totais incluem todo o período.' : '');
}
async function request(path, body = {}) {
  const response = await fetch('/api/influencer/' + path, { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(60000) });
  const result = await response.json();
  if (!response.ok || !result.success) { const error = new Error(result.error || 'Não foi possível consultar o portal.'); error.status=response.status; throw error; }
  return result.data;
}
function showLogin() { $('portalDashboard').hidden=true; $('portalLogin').hidden=false; $('portalSalesBody').replaceChildren(); $('portalMetrics').replaceChildren(); }
async function refresh(silent = false) {
  $('portalDashboardMessage').textContent='Consultando suas vendas…';
  try { const data = await request('dashboard',{from:$('portalFrom').value,to:$('portalTo').value}); render(data); $('portalDashboardMessage').textContent='Dados atualizados agora.'; }
  catch(error) {
    if(error.status===401) showLogin();
    if(!(silent && error.status===401)) { $('portalLoginMessage').textContent=error.message; $('portalDashboardMessage').textContent=error.message; }
  }
}
const now = new Date();
const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
$('portalFrom').value = localDate(new Date(now.getFullYear(),now.getMonth(),1)); $('portalTo').value = localDate(now);
$('influencerLoginForm').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('button[type="submit"]'); button.disabled=true;
  $('portalLoginMessage').textContent='Conferindo seu acesso…';
  try {
    await request('login',{email:$('portalEmail').value.trim(),phone:$('portalPhone').value,password:$('portalPassword').value});
    $('portalPassword').value=''; await refresh();
  } catch(error) { $('portalLoginMessage').textContent=error.message || 'Não foi possível entrar. Confira seus dados ou solicite a liberação à loja.'; }
  finally { button.disabled=false; }
});
$('portalPeriod').addEventListener('submit',event=>{event.preventDefault();void refresh();});
$('portalLogout').addEventListener('click',async()=>{try{await request('logout');showLogin();$('portalLoginMessage').textContent='Você saiu do portal.';}catch(error){$('portalDashboardMessage').textContent=error.message;}});
void refresh(true);

function safeImage(value) { try { const url=new URL(value,location.origin);return url.protocol==='https:' || (url.origin===location.origin && url.pathname.startsWith('/assets/')) ? url.href : ''; } catch { return ''; } }
function renderPromotions(data) {
  const campaign=data.campaign;
  $('campaignHeading').textContent=campaign?.title || 'Ofertas exclusivas';
  $('portalCampaignDescription').textContent=campaign?.description || 'A loja está preparando novas campanhas para você divulgar.';
  const card=(product,rank)=>{const image=safeImage(product.image);return `<article class="portal-product-card">${image ? `<img class="product-image" src="${esc(image)}" alt="${esc(product.name)}" loading="lazy">` : '<div class="product-image-placeholder">Imagem indisponível</div>'}<div>${rank ? `<span class="eyebrow">${rank}º · ${esc(product.quantity)} unidade(s)</span>` : '<span class="eyebrow">CAMPANHA EXCLUSIVA</span>'}<h3>${esc(product.name || product.sku)}</h3><p>${esc(product.description || '')}</p><a class="outline-button" href="/index.html?search=${encodeURIComponent(product.sku)}#colecao">Ver produto na loja ↗</a></div></article>`;};
  $('portalCampaign').innerHTML=campaign?.products?.length ? campaign.products.slice(0,3).map(p=>card(p)).join('') : '<p class="field-help">Nenhuma campanha ativa no momento.</p>';
  $('portalBestSellers').innerHTML=data.bestSellers?.length ? data.bestSellers.map((p,i)=>card(p,i+1)).join('') : '<p class="field-help">Nenhum produto vendido em pedidos pagos neste período.</p>';
}
