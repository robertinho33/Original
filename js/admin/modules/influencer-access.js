const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-influencer-access]'); if(!trigger)return;
  const dialog=document.createElement('dialog'); dialog.className='influencer-access-dialog';
  dialog.innerHTML=`<form><h2>Acesso ao portal</h2><p>${esc(trigger.dataset.name)} · ${esc(trigger.dataset.email)}</p><p>O login usa o e-mail e telefone salvos no cadastro. Para alterá-los, edite o influenciador antes de liberar o acesso.</p><label>Senha com letras e números<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="16" pattern="(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{8,16}" ></label><small>8 a 16 caracteres. Somente letras e números, incluindo ambos. ${trigger.dataset.enabled==='true'?'Deixe em branco para manter a senha atual.':'Deixe em branco para gerar uma senha inicial individual.'}</small><p role="status" class="access-message"></p><div class="access-actions"><button type="submit" class="btn btn-primary">Salvar e liberar acesso</button><button type="button" data-invite-access>Gerar convite / redefinir senha</button><button type="button" data-disable-access ${trigger.dataset.enabled==='true'?'':'hidden'}>Bloquear acesso</button><button type="button" data-close-access>Fechar</button></div></form>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('[data-close-access]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>dialog.remove());
  const submit=async (enabled,reset=false)=>{
    const message=dialog.querySelector('.access-message'); const buttons=dialog.querySelectorAll('button'); buttons.forEach(button=>button.disabled=true);
    try {
      const result=await window.AdminAPI.put(`/influencers/${encodeURIComponent(trigger.dataset.influencerAccess)}/access`,{enabled,reset,password:enabled&&!reset?dialog.querySelector('[name="password"]').value:undefined});
      dialog.querySelector('[name="password"]').value=''; trigger.dataset.enabled=String(enabled);trigger.textContent=enabled?'Gerenciar acesso':'Liberar acesso';
      message.textContent=enabled?(result.data?.initialPassword?'Senha inicial: '+result.data.initialPassword+'. Copie agora e compartilhe por um canal privado. Ela não será exibida novamente.':'Acesso liberado. O influenciador pode alterar a senha no portal.'):'Acesso bloqueado.';
      dialog.querySelector('[data-whatsapp-invite]')?.remove();
      if(result.data?.whatsappUrl?.startsWith('https://wa.me/')){const link=document.createElement('a');link.dataset.whatsappInvite='';link.href=result.data.whatsappUrl;link.target='_blank';link.rel='noopener noreferrer';link.className='btn btn-primary';link.textContent='Abrir convite no WhatsApp';message.after(link);message.textContent='Convite gerado. A senha temporária expira em 48 horas e deve ser trocada no primeiro acesso. Abra o WhatsApp para revisar e enviar. O convite anterior e as sessões antigas foram invalidados.';}
      dialog.querySelector('[data-disable-access]').hidden=!enabled;
    }catch(error){message.textContent=error.message||'Não foi possível alterar o acesso.';}
    finally{buttons.forEach(button=>button.disabled=false);}
  };
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();void submit(true);});
  dialog.querySelector('[data-invite-access]').addEventListener('click',()=>submit(true,true));
  dialog.querySelector('[data-disable-access]').addEventListener('click',()=>submit(false));
});
