const labels={followers:'Seguidores e botão Me seguir',gallery:'Galeria de até seis fotos comerciais',sharing:'Botões Copiar link e Compartilhar no WhatsApp'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.addEventListener('click',async event=>{
 const trigger=event.target.closest('[data-rollout-global],[data-rollout-owner]');if(!trigger)return;
 const owner=trigger.dataset.rolloutOwner,path='/community/rollout'+(owner?'/'+encodeURIComponent(owner):'');
 if(!document.querySelector('link[href="/css/community.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/css/community.css';document.head.append(link);}
 const dialog=document.createElement('dialog');dialog.className='community-admin-dialog';dialog.innerHTML='<p>Carregando permissões…</p>';document.body.append(dialog);dialog.showModal();let closed=false;
 dialog.addEventListener('close',()=>{closed=true;dialog.remove();});
 function render(data,notice=''){
  const global=owner?data.global:data,individual=data.individual||{},revision=owner?individual.revision:global.revision;
  dialog.innerHTML='<header class="community-admin-header"><h2>'+ (owner?'Liberação · '+esc(trigger.dataset.name):'Disponibilidade da atualização')+'</h2><button type="button" data-close>Fechar</button></header><p>Esta atualização fica oculta até você liberar. As permissões controlam a exibição e o acesso no servidor.</p><form class="community-permissions">'+(owner?'<p><strong>'+(global.enabled?'Chave geral ativada.':'Chave geral desligada: todos os recursos continuam ocultos, mesmo com liberação individual.')+'</strong></p>'+Object.entries(labels).map(([key,label])=>'<label>'+label+'<select name="'+key+'"><option value="inherit" '+(individual[key]==='inherit'?'selected':'')+'>Seguir padrão coletivo ('+(global.defaults[key]?'liberado':'bloqueado')+')</option><option value="allow" '+(individual[key]===true?'selected':'')+'>Liberar para este influenciador</option><option value="block" '+(individual[key]===false?'selected':'')+'>Bloquear para este influenciador</option></select></label>').join('')+'<p>Disponível agora: '+Object.keys(labels).filter(key=>data.effective[key]).map(key=>labels[key]).join(', ')+(Object.values(data.effective).some(Boolean)?'.':'nenhum recurso.')+'</p>':'<label class="community-check"><input type="checkbox" name="enabled" '+(global.enabled?'checked':'')+'> Ativar chave geral da atualização</label><p>Desligar esta chave suspende os recursos para todos, preservando os dados e as exceções individuais.</p><fieldset><legend>Liberação coletiva · padrão para todos</legend>'+Object.entries(labels).map(([key,label])=>'<label class="community-check"><input type="checkbox" name="'+key+'" '+(global.defaults[key]?'checked':'')+'> '+label+'</label>').join('')+'</fieldset><p>O padrão coletivo vale para quem está em “Seguir padrão coletivo”. As liberações e os bloqueios individuais são preservados. Use “Liberar recursos” na linha do influenciador para definir as exceções.</p>')+'<div class="community-actions"><button type="submit">Salvar permissões</button></div><p role="status" aria-live="polite">'+esc(notice)+'</p></form>';
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  const form=dialog.querySelector('form'),status=form.querySelector('[role=status]');
  form.addEventListener('submit',async event=>{
   event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='Salvando…';let body;
   if(owner)body={revision,...Object.fromEntries(Object.keys(labels).map(key=>[key,form.elements.namedItem(key).value==='allow'?true:form.elements.namedItem(key).value==='block'?false:'inherit']))};
   else body={revision,enabled:form.elements.namedItem('enabled').checked,defaults:Object.fromEntries(Object.keys(labels).map(key=>[key,form.elements.namedItem(key).checked]))};
   try{const result=await window.AdminAPI.put(path,body);if(!closed)render(result.data,'Permissões salvas. '+((owner?result.data.global:result.data).enabled?'As regras já estão valendo.':'A atualização permanece oculta para todos.'));}
   catch(error){status.textContent=error.message;button.disabled=false;}
  });
 }
 try{const result=await window.AdminAPI.get(path);if(!closed)render(result.data);}catch(error){dialog.textContent=error.message;const close=document.createElement('button');close.textContent='Fechar';close.addEventListener('click',()=>dialog.close());dialog.append(close);}
});
