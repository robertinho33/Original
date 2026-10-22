const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const money=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function mountStoreEditor(container,{onUnauthorized=()=>{}}={}){
  if(!container)return {reset(){}};
  container.innerHTML='<p class="eyebrow">ESCOLHA SEUS PRODUTOS · 3 DE 3</p><h2>Produtos da minha vitrine</h2><p>Escolha até seis produtos. Você pode trocar a seleção quando quiser, mantendo o mesmo link. Nome, cupom e ativação são administrados pela loja.</p><button type="button" class="outline-button" data-load-store>Escolher ou trocar produtos</button><div data-store-content hidden></div>';
  const loadButton=container.querySelector('[data-load-store]'),content=container.querySelector('[data-store-content]');let generation=0;
  async function request(method,body){
    const response=await fetch('/api/influencer/store',{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
    const result=await response.json();if(!response.ok||!result.success){if(response.status===401)onUnauthorized();throw Error(result.error||'Não foi possível acessar sua vitrine.');}return result.data;
  }
  loadButton.addEventListener('click',async()=>{
    const current=++generation;loadButton.disabled=true;content.hidden=false;content.textContent='Carregando sua seleção…';
    try{
      const data=await request('POST',{});if(current!==generation)return;
      const catalog=Array.isArray(data.catalog)?data.catalog:[],bySku=new Map(catalog.map(p=>[p.sku,p]));
      let selected=new Set(data.selectedSkus||[]),revision=data.revision;
      content.innerHTML=`<p><strong>${esc(data.name)}</strong> · ${data.published?'Vitrine publicada':'Rascunho: a loja precisa ativar a publicação'}</p><p data-own-store-link></p><form class="own-store-form"><label>Buscar produto<input type="search" data-search-store placeholder="Nome ou SKU" autocomplete="off"></label><p data-selection-count aria-live="polite"></p><div class="own-store-selected" data-selected-store></div><p data-search-count></p><div class="own-store-list" data-store-products></div><button type="submit" class="solid-button">Salvar produtos da minha vitrine</button><p data-store-message role="status" aria-live="polite"></p></form>`;
      if(data.storeUrl?.startsWith('/pages/vitrine-influenciador.html?loja=')){const link=document.createElement('a');link.href=data.storeUrl;link.textContent='Abrir minha vitrine ↗';link.target='_blank';link.rel='noopener noreferrer';content.querySelector('[data-own-store-link]').append(link);}
      const form=content.querySelector('form'),list=form.querySelector('[data-store-products]'),search=form.querySelector('[data-search-store]'),message=form.querySelector('[data-store-message]');
      function sync(){
        form.querySelector('[data-selection-count]').textContent=`${selected.size} de 6 produtos selecionados.`;
        form.querySelector('[data-selected-store]').innerHTML=[...selected].map(sku=>`<button type="button" class="outline-button" data-remove-store="${esc(sku)}" aria-label="Remover ${esc(bySku.get(sku)?.name||sku)}">${esc(bySku.get(sku)?.name||sku)}${bySku.has(sku)?'':' · indisponível'} ×</button>`).join('');
        for(const checkbox of list.querySelectorAll('input')){checkbox.checked=selected.has(checkbox.value);checkbox.disabled=selected.size>=6&&!checkbox.checked;}
      }
      function render(){
        const query=normalize(search.value),found=catalog.filter(p=>normalize(p.name+' '+p.sku).includes(query));
        form.querySelector('[data-search-count]').textContent=`${found.length} produto(s) encontrado(s).${found.length>24?' Exibindo 24; use a busca para localizar os demais.':''}`;
        list.innerHTML=found.slice(0,24).map(p=>`<label class="own-store-choice"><input type="checkbox" value="${esc(p.sku)}"><span><strong>${esc(p.name)}</strong><small>SKU: ${esc(p.sku)} · ${esc(money(p.price))}</small></span></label>`).join('')||'<p>Nenhum produto encontrado.</p>';sync();
      }
      list.addEventListener('change',event=>{const checkbox=event.target;if(checkbox.tagName!=='INPUT')return;if(checkbox.checked&&selected.size<6)selected.add(checkbox.value);else selected.delete(checkbox.value);sync();});
      form.querySelector('[data-selected-store]').addEventListener('click',event=>{const button=event.target.closest('[data-remove-store]');if(button){selected.delete(button.dataset.removeStore);sync();}});
      search.addEventListener('input',render);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(selected.size<1||selected.size>6){message.textContent='Escolha de um a seis produtos.';return;}
        const button=form.querySelector('[type="submit"]');button.disabled=true;message.textContent='Salvando sua seleção…';
        try{const saved=await request('PUT',{skus:[...selected],revision});if(current!==generation)return;selected=new Set(saved.selectedSkus);revision=saved.revision;sync();message.textContent=data.published?'Produtos atualizados. O link da sua vitrine continua o mesmo.':'Seleção salva no mesmo rascunho. A publicação será ativada pela loja.';}
        catch(error){if(current===generation)message.textContent=error.message;}finally{button.disabled=false;}
      });render();
    }catch(error){if(current===generation)content.textContent=error.message;}finally{if(current===generation)loadButton.disabled=false;}
  });
  return {reset(){generation++;content.replaceChildren();content.hidden=true;loadButton.disabled=false;}};
}
