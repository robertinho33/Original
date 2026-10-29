export async function renderApplications(container){
 container.innerHTML='<h2>Candidaturas de influenciadores</h2><p>Cadastro sujeito à análise. Aprovar cria um cadastro inativo, sem acesso ao portal e sem comissão. Configure e libere o acesso separadamente após a revisão.</p><button type="button" class="btn">Atualizar candidaturas</button><p role="status" aria-live="polite"></p><div data-applications></div>';
 const status=container.querySelector('[role=status]'),list=container.querySelector('[data-applications]'),refresh=container.querySelector('button');
 async function load(){refresh.disabled=true;status.textContent='Carregando…';try{
  const result=await window.AdminAPI.get('/influencer-applications');list.replaceChildren();
  for(const row of result.data){
   const article=document.createElement('article'),title=document.createElement('h3');title.textContent=row.name+' · '+({pending:'Pendente',approved:'Aprovada',rejected:'Rejeitada'}[row.status]||row.status);article.append(title);
   for(const [key,label] of Object.entries({createdAt:'Enviada em',email:'E-mail',phone:'WhatsApp',city:'Cidade',profileUrl:'Perfil público',followers:'Seguidores',averageViews:'Média de visualizações',niche:'Nicho',audience:'Público',salesExperience:'Experiência em vendas',contentPlan:'Plano de divulgação',reviewedAt:'Analisada em',reviewedBy:'Responsável'})){
    if(row[key]==null)continue;const p=document.createElement('p');p.textContent=label+': '+row[key];article.append(p);
   }
   if(row.status==='pending')for(const [decision,label] of [['approved','Aprovar candidatura'],['rejected','Rejeitar candidatura']]){
    const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=label;article.append(button);
    button.addEventListener('click',async()=>{if(!confirm(label+' de '+row.name+'?'))return;article.querySelectorAll('button').forEach(b=>b.disabled=true);
     try{await window.AdminAPI.put('/influencer-applications/'+encodeURIComponent(row.id),{decision});await load();status.textContent='Decisão registrada. Atualize a lista de influenciadores para ver novos cadastros.';}
     catch(error){status.textContent=error.message;article.querySelectorAll('button').forEach(b=>b.disabled=false);}
    });
   }
   list.append(article);
  }
  status.textContent=result.data.length?`${result.data.length} candidaturas mais recentes.`:'Nenhuma candidatura recebida.';
 }catch(error){status.textContent=error.message;}finally{refresh.disabled=false;}}
 refresh.addEventListener('click',load);await load();
}
