import '../../influencer-identity.js';
const {filterInfluencers,duplicateIds,introducedDuplicate}=globalThis.InfluencerIdentity;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderInfluencersWorkspace(container,initialRows){
 let rows=initialRows,editing=null,saving=false;
 container.innerHTML=`<section class="admin-influencers-module influencer-workspace"><div class="influencer-toolbar"><p data-summary></p><button type="button" class="btn btn-primary" data-new>Novo influenciador</button></div><form class="influencer-filters" role="search"><label>Pesquisar<input name="query" type="search" placeholder="Nome, e-mail, telefone ou PIX" autocomplete="off"></label><label>Status<select name="status"><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label><label>Acesso ao portal<select name="access"><option value="all">Todos</option><option value="enabled">Liberado</option><option value="disabled">Não liberado</option></select></label><label class="influencer-check"><input name="duplicates" type="checkbox"> Possíveis duplicados</label><button type="reset" class="btn">Limpar filtros</button></form><p data-notice role="status" aria-live="polite"></p><div data-editor hidden></div><p data-count class="admin-help-text" aria-live="polite"></p><div class="admin-table-wrapper influencer-compact-table"><table class="admin-table"><thead><tr><th>Influenciador</th><th>Contato</th><th>Repasse</th><th>Status</th><th>Ações</th></tr></thead><tbody></tbody></table></div></section>`;
 const filters=container.querySelector('.influencer-filters'),body=container.querySelector('tbody'),editor=container.querySelector('[data-editor]'),notice=container.querySelector('[data-notice]');
 function draw(){
  for(const button of body.querySelectorAll('[data-influencer-access]')){const row=rows.find(r=>String(r.id)===button.dataset.influencerAccess);if(row)row.portalEnabled=button.dataset.enabled==='true';}
  const state={query:filters.elements.query.value,status:filters.elements.status.value,access:filters.elements.access.value,duplicates:filters.elements.duplicates.checked},visible=filterInfluencers(rows,state),duplicates=duplicateIds(rows);
  container.querySelector('[data-summary]').textContent=`${rows.length} cadastros · ${rows.filter(r=>r.active!==false).length} ativos`;
  container.querySelector('[data-count]').textContent=`${visible.length} de ${rows.length} influenciadores${duplicates.size?' · '+duplicates.size+' cadastros com possível duplicidade':''}`;
  body.innerHTML=visible.length?visible.map(row=>`<tr><td data-label="Influenciador"><strong>${esc(row.name)}</strong>${duplicates.has(String(row.id))?'<small class="influencer-duplicate">Revisar duplicidade</small>':''}</td><td data-label="Contato"><span>${esc(row.email||'Sem e-mail')}</span><small>${esc(row.phone||'Sem telefone')}</small></td><td data-label="Repasse"><strong>${Number(row.commissionDefault||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</strong><small>PIX: ${esc(row.pixKey||'Não informado')}</small></td><td data-label="Status"><span class="influencer-status ${row.active===false?'inactive':''}">${row.active===false?'Inativo':'Ativo'}</span><small>${row.portalEnabled?'Portal liberado':'Portal não liberado'}</small></td><td data-label="Ações"><div class="influencer-actions"><button type="button" class="btn" data-edit="${esc(row.id)}">Editar</button><button type="button" class="btn" data-influencer-access="${esc(row.id)}" data-name="${esc(row.name)}" data-email="${esc(row.email||'')}" data-enabled="${row.portalEnabled===true}">${row.portalEnabled?'Gerenciar acesso':'Liberar acesso'}</button><button type="button" class="btn" data-influencer-store="${esc(row.id)}" data-name="${esc(row.name)}">Vitrine pública</button></div></td></tr>`).join(''):'<tr><td colspan="5">Nenhum influenciador encontrado. Ajuste os filtros ou cadastre um novo.</td></tr>';
 }
 function closeEditor(){if(saving)return;editor.hidden=true;editor.replaceChildren();editing=null;}
 function openEditor(row=null){
  if(saving)return;editing=row;notice.textContent='';editor.hidden=false;
  const field=(name,label,type='text')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(row?.[name]||'')}" ${name==='name'?'required':''} maxlength="${name==='pixKey'?160:200}"></label>`;
  editor.innerHTML=`<form class="influencer-editor"><h3>${row?'Editar '+esc(row.name):'Novo influenciador'}</h3><div class="influencer-fields">${field('name','Nome')}${field('email','E-mail','email')}${field('phone','Telefone','tel')}${field('pixKey','Chave PIX para repasses')}<label>Comissão padrão (%)<input name="commissionDefault" type="number" min="0" max="100" step="0.01" required value="${Number(row?.commissionDefault||0)}"></label><label class="influencer-check"><input name="active" type="checkbox" ${row?.active===false?'':'checked'}> Cadastro ativo</label></div><div class="influencer-actions"><button type="submit" class="btn btn-primary">${row?'Salvar alterações':'Cadastrar influenciador'}</button><button type="button" class="btn" data-cancel>Cancelar</button></div><p data-message role="status" aria-live="polite"></p></form>`;
  const form=editor.querySelector('form'),message=editor.querySelector('[data-message]');
  form.querySelector('[data-cancel]').addEventListener('click',closeEditor);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(saving)return;
   const value=name=>form.elements.namedItem(name).value.trim();
   const data={name:value('name'),email:value('email'),phone:value('phone'),pixKey:value('pixKey'),commissionDefault:Number(value('commissionDefault')),active:form.elements.namedItem('active').checked};
   const duplicate=introducedDuplicate(rows,data,editing);if(duplicate){message.textContent='Já existe um cadastro com esses dados: '+duplicate.name+'. Edite o cadastro existente.';return;}
   saving=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent='Salvando…';
   let saved=false;
   try{
    const result=editing?await window.AdminAPI.updateInfluencer(editing.id,data):await window.AdminAPI.createInfluencer(data);
    if(!result?.success)throw Error(result?.error||'Não foi possível salvar.');
    const item={...editing,...data,...result.data};rows=editing?rows.map(r=>String(r.id)===String(editing.id)?item:r):[...rows,item];saved=true;
    notice.textContent=editing?'Dados do influenciador atualizados.':'Influenciador cadastrado.';
   }catch(error){message.textContent=error.message;}
   finally{saving=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
   if(saved){closeEditor();draw();}
  });
  editor.scrollIntoView?.({block:'nearest',behavior:'smooth'});form.elements.namedItem('name').focus();
 }
 filters.addEventListener('submit',event=>event.preventDefault());filters.addEventListener('input',draw);filters.addEventListener('change',draw);
 filters.addEventListener('reset',()=>{queueMicrotask(draw);});
 container.querySelector('[data-new]').addEventListener('click',()=>openEditor());
 body.addEventListener('click',event=>{const button=event.target.closest('[data-edit]');if(button){const row=rows.find(r=>String(r.id)===button.dataset.edit);if(row)openEditor(row);}});
 draw();
}
