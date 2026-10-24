const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(values,current)=>values.map(([v,label])=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(label)}</option>`).join('');
const goals=[['hydration','Hidratação e maciez'],['repair','Fios danificados'],['frizz','Controle do frizz'],['curls','Definição dos cachos'],['color','Cuidado da cor']];
const steps=[['wash','Limpar'],['treat','Tratar'],['finish','Finalizar']];
const hairs=[['all','Todos os tipos'],['straight','Liso'],['wavy','Ondulado'],['curly','Cacheado'],['coily','Crespo']];
const chemicals=[['all','Com ou sem química'],['treated','Com química ou coloração'],['natural','Sem química']];
function addStyles(){if(document.querySelector('link[href="/css/discovery.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/css/discovery.css';document.head.append(link);}
function productOptions(catalog,value){return '<option value="">Selecione um produto</option>'+options(catalog.map(p=>[p.sku,p.name]),value);}
export async function renderRitualTools(container){
  const access=await window.AdminAPI.get('/access');if(access.data?.role!=='admin')return;
  addStyles();const result=await window.AdminAPI.get('/marketing/ritual'),data=result.data||{};
  container.innerHTML=`<section class="module-panel"><h2>Curadoria · Cuidado do seu jeito</h2><p>Cadastre indicações que você revisou. A seleção automática começa com shampoo e condicionador da mesma linha. Se couber no orçamento, inclui a máscara e depois o finalizador da linha. As indicações revisadas ajudam a orientar a escolha. Produtos ocultos ou sem estoque não são sugeridos.</p><form><label><input name="enabled" type="checkbox" ${data.enabled?'checked':''}> Habilitar recomendações</label><label><input name="automatic" type="checkbox" ${data.automatic?'checked':''}> Completar automaticamente com categorias e preços do catálogo</label><div data-rules></div><button type="button" data-add-rule>Adicionar indicação</button> <button type="submit" class="admin-button admin-button-primary">Salvar curadoria</button><p role="status"></p></form></section>`;
  const form=container.querySelector('form'),rows=form.querySelector('[data-rules]'),message=form.querySelector('[role="status"]');
  const add=(rule={})=>{
    if(rows.children.length>=30){message.textContent='Limite de 30 indicações.';return;}
    const row=document.createElement('fieldset');row.className='discovery-admin-row';row.innerHTML=`<legend>Indicação revisada pela loja</legend><label>Produto<select data-field="sku" required>${productOptions(result.catalog||[],rule.sku)}</select></label><label>Objetivo<select data-field="goal">${options(goals,rule.goal)}</select></label><label>Etapa<select data-field="step">${options(steps,rule.step)}</select></label><label>Tipo de cabelo<select data-field="hair">${options(hairs,rule.hair||'all')}</select></label><label>Química<select data-field="chemistry">${options(chemicals,rule.chemistry||'all')}</select></label><label>Por que indicar este produto?<textarea data-field="reason" maxlength="400" required>${esc(rule.reason)}</textarea></label><button type="button" data-remove>Remover indicação</button>`;
    // Preserve an unavailable selection so that an unrelated edit cannot silently replace it.
    if(rule.sku&&!result.catalog?.some(p=>p.sku===rule.sku)){const option=document.createElement('option');option.value=rule.sku;option.textContent=rule.sku+' · indisponível: substitua ou remova';option.selected=true;row.querySelector('[data-field="sku"]').append(option);}
    row.querySelector('[data-remove]').addEventListener('click',()=>row.remove());rows.append(row);
  };
  (data.rules||[]).forEach(add);form.querySelector('[data-add-rule]').addEventListener('click',()=>add());
  form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{await window.AdminAPI.put('/marketing/ritual',{enabled:form.elements.enabled.checked,automatic:form.elements.automatic.checked,rules:[...rows.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el.value])))});message.textContent='Curadoria salva. As novas indicações já podem ser consultadas.';}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
}
document.addEventListener('click',async event=>{
  const trigger=event.target.closest('[data-influencer-store]');if(!trigger)return;
  const id=trigger.dataset.influencerStore;addStyles();
  const dialog=document.createElement('dialog');dialog.className='discovery-dialog';dialog.innerHTML='<p>Carregando vitrine…</p>';document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove());
  try{
    const result=await window.AdminAPI.get('/influencers/'+encodeURIComponent(id)+'/store'),data=result.data||{},url=location.origin+'/pages/vitrine-influenciador.html?loja='+encodeURIComponent(id);
    dialog.innerHTML=`<form><h2>Vitrine pública do influenciador</h2><p>Somente estes dados e a seleção serão publicados. E-mail, telefone, comissões e vendas permanecem restritos.</p><label><input name="enabled" type="checkbox" ${data.enabled?'checked':''}> Ativar vitrine pública</label><label>Nome público<input name="name" maxlength="100" value="${esc(data.name||trigger.dataset.name)}"></label><label>Apresentação<textarea name="bio" maxlength="500">${esc(data.bio)}</textarea></label><label>Foto — URL HTTPS<input name="image" type="url" value="${esc(data.image)}"></label><label>Vídeo — link do YouTube, Instagram ou TikTok<input name="videoUrl" type="url" value="${esc(data.videoUrl)}"></label><label>Cupom ativo vinculado ao influenciador<input name="coupon" maxlength="60" value="${esc(data.coupon)}"></label>${[0,1,2,3,4,5].map(i=>`<label>Favorito ${i+1}<select name="sku${i}">${productOptions(result.catalog||[],data.skus?.[i])}</select></label>`).join('')}<div data-publication-status></div><p data-publication-link-wrap hidden>Link para compartilhar: <a data-publication-link target="_blank" rel="noopener noreferrer"></a></p><p role="status"></p><div class="form-actions"><button type="submit">Salvar vitrine</button><button type="button" data-close>Fechar</button></div></form>`;
    dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
    const form=dialog.querySelector('form');
    const updatePublication=publication=>{
      const published=publication?.published===true,wrap=form.querySelector('[data-publication-link-wrap]'),link=form.querySelector('[data-publication-link]');
      wrap.hidden=!published;
      if(published){link.href=url;link.textContent=url;}else{link.removeAttribute('href');link.textContent='';}
      const issues=Array.isArray(publication?.issues)?publication.issues:['Salve e ative esta vitrine para disponibilizar o link.'];
      form.querySelector('[data-publication-status]').innerHTML=published?'<p><strong>Vitrine publicada.</strong> O link está disponível para compartilhar.</p>':`<p><strong>Vitrine não publicada.</strong> Complete os passos abaixo:</p><ul>${issues.map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul>`;
    };
    updatePublication(result.publication);
    for(let i=0;i<6;i++)if(data.skus?.[i]&&!result.catalog?.some(p=>p.sku===data.skus[i])){const option=document.createElement('option');option.value=data.skus[i];option.textContent=data.skus[i]+' · indisponível: substitua ou remova';option.selected=true;form.elements['sku'+i].append(option);}
    form.addEventListener('submit',async ev=>{ev.preventDefault();const values=new FormData(form),body=Object.fromEntries(['name','bio','image','videoUrl','coupon'].map(k=>[k,values.get(k)]));body.enabled=values.has('enabled');body.skus=[0,1,2,3,4,5].map(i=>values.get('sku'+i)).filter(Boolean);const button=form.querySelector('[type="submit"]');button.disabled=true;try{const saved=await window.AdminAPI.put('/influencers/'+encodeURIComponent(id)+'/store',body);updatePublication(saved.publication);form.querySelector('[role="status"]').textContent=body.enabled?'Vitrine salva e ativada.':'Vitrine salva e desativada.';}catch(error){form.querySelector('[role="status"]').textContent=error.message;}finally{button.disabled=false;}});
  }catch(error){dialog.textContent=error.message;const close=document.createElement('button');close.textContent='Fechar';close.onclick=()=>dialog.close();dialog.append(close);}
});
