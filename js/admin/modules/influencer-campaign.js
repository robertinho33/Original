const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=value=>value ? new Date(Date.parse(value)-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
export async function renderInfluencerCampaign(container) {
  const access=await window.AdminAPI.get('/access');
  if(access.data?.role!=='admin')return;
  const result=await window.AdminAPI.get('/marketing/influencer-campaign'), data=result.data||{};
  container.innerHTML=`<div class="module-panel"><h2>Campanha exclusiva dos influenciadores</h2><p>Até três produtos diferentes, exibidos apenas no portal. O preço cobrado continua sendo o do catálogo.</p><form class="admin-form" id="influencerCampaignForm"><label>Título<input name="title" maxlength="120" value="${esc(data.title)}"></label><label><input name="enabled" type="checkbox" ${data.enabled?'checked':''}> Campanha ativa</label><label class="admin-form-full">Descrição da campanha<textarea name="description" maxlength="600">${esc(data.description)}</textarea></label><label>Início<input name="startsAt" type="datetime-local" value="${esc(localDate(data.startsAt))}"></label><label>Término<input name="endsAt" type="datetime-local" value="${esc(localDate(data.endsAt))}"></label>${[0,1,2].map(i=>{const p=data.products?.[i]||{};return `<fieldset class="admin-form-full"><legend>Produto ${i+1} — opcional</legend><label>SKU do catálogo<input name="sku${i}" maxlength="100" value="${esc(p.sku)}"></label><label>Nome<input name="name${i}" maxlength="180" value="${esc(p.name)}"></label><label>URL da imagem<input name="image${i}" type="url" value="${esc(p.image)}" placeholder="https://..."></label><label>Descrição da oferta<textarea name="description${i}" maxlength="800">${esc(p.description)}</textarea></label></fieldset>`;}).join('')}<button type="submit" class="admin-button admin-button-primary">Salvar campanha do portal</button><p role="status" id="influencerCampaignMessage"></p></form></div>`;
  const form=container.querySelector('form');
  for(let i=0;i<3;i++){
    const input=form.elements['sku'+i], select=document.createElement('select');
    select.name=input.name;
    const catalog=[...(result.catalog||[])];
    if(input.value&&!catalog.some(p=>p.sku===input.value))catalog.push({sku:input.value,name:form.elements['name'+i].value});
    select.innerHTML='<option value="">Escolha um produto</option>'+catalog.map(p=>`<option value="${esc(p.sku)}">${esc(p.name)} · ${esc(p.sku)}</option>`).join('');
    select.value=input.value;input.replaceWith(select);
    select.closest('label').firstChild.textContent='Produto do catálogo';
    select.addEventListener('change',()=>{const product=catalog.find(p=>p.sku===select.value);for(const key of ['name','image','description'])form.elements[key+i].value=product?.[key]||'';});
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();const values=new FormData(form), body={title:values.get('title'),description:values.get('description'),enabled:values.has('enabled'),products:[]};
    for(const field of ['startsAt','endsAt'])body[field]=values.get(field)?new Date(values.get(field)).toISOString():'';
    for(let i=0;i<3;i++){const row=Object.fromEntries(['sku','name','image','description'].map(key=>[key,values.get(key+i).trim()]));if(Object.values(row).some(Boolean))body.products.push(row);}
    const message=container.querySelector('[role="status"]'), button=form.querySelector('button[type="submit"]');button.disabled=true;
    try{await window.AdminAPI.put('/marketing/influencer-campaign',body);message.textContent=body.enabled?'Campanha salva e ativa no portal.':'Campanha salva e desativada.';}catch(error){message.textContent=error.message;}finally{button.disabled=false;}
  });
}
