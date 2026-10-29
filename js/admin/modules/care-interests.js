const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={hair:{straight:'Liso',wavy:'Ondulado',curly:'Cacheado',coily:'Crespo'},chemistry:{treated:'Com química / coloração',natural:'Sem química'},goal:{hydration:'Hidratação e maciez',repair:'Fios danificados',frizz:'Controle do frizz',curls:'Definição dos cachos',color:'Cuidado da cor',nutrition:'Nutrição dos fios',oiliness:'Controle da oleosidade'},budgetBand:{up100:'Até R$ 100','100to200':'Mais de R$ 100 até R$ 200','200to400':'Mais de R$ 200 até R$ 400',over400:'Mais de R$ 400'}};
export async function renderCareInterests(container,api=window.AdminAPI){
 const day=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date),today=day(new Date()),before=day(new Date(Date.now()-29*86400000));
 container.className='module-panel care-interests';container.innerHTML='<h2>O que os visitantes procuram</h2><p>Interesses em Cuidado do seu jeito, sem identificação de visitantes. Combine os filtros para orientar sua curadoria e campanhas.</p><form class="workspace-filters"><label>De<input name="from" type="date" value="'+before+'" required></label><label>Até<input name="to" type="date" value="'+today+'" required></label>'+Object.entries(labels).map(([name,options])=>'<label>'+({hair:'Cabelo',chemistry:'Química',goal:'Objetivo',budgetBand:'Orçamento'}[name])+'<select name="'+name+'"><option value="all">Todos</option>'+Object.entries(options).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select></label>').join('')+'<button type="submit">Consultar interesses</button></form><p data-care-status role="status" aria-live="polite"></p><div data-care-metrics class="workspace-metrics"></div><div data-care-results></div><p class="admin-help-text">Até 31 dias por consulta. Combinações por sessão com consentimento, sem pessoas únicas ou vínculo com vendas. A coleta começa após a publicação; não há histórico retroativo.</p>';
 const form=container.querySelector('form'),status=container.querySelector('[data-care-status]');let version=0;
 const load=async()=>{
  const current=++version,filters=Object.fromEntries(new FormData(form)),days=(Date.parse(filters.to)-Date.parse(filters.from))/86400000;
  container.querySelector('[data-care-metrics]').textContent='';container.querySelector('[data-care-results]').textContent='';
  if(!Number.isFinite(days)||days<0||days>30){status.textContent='Escolha um período válido de até 31 dias.';return;}
  status.textContent='Consultando interesses…';
  try{
   const response=await api.get('/care-interests?'+new URLSearchParams(filters)),data=response.data;
   if(current!==version||!container.isConnected)return;
   status.textContent=data.queries?'Dados do período selecionado.':'Ainda não há consultas com consentimento para estes filtros.';
   container.querySelector('[data-care-metrics]').innerHTML=[['Consultas',data.queries],['Seleções completas',data.complete],['Seleções parciais',data.partial],['Sem indicação',data.none]].map(([label,value])=>'<article><span>'+label+'</span><strong>'+esc(value)+'</strong></article>').join('');
   if(data.profiles.length)container.querySelector('[data-care-results]').innerHTML='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Cabelo</th><th>Química</th><th>Objetivo</th><th>Orçamento</th><th>Consultas</th><th>Sem indicação</th></tr></thead><tbody>'+data.profiles.map(row=>'<tr>'+['hair','chemistry','goal','budgetBand'].map(key=>'<td>'+esc(labels[key][row[key]])+'</td>').join('')+'<td>'+esc(row.queries)+'</td><td>'+esc(row.none)+'</td></tr>').join('')+'</tbody></table></div>';
  }catch(error){if(current===version)status.textContent=error.message||'Não foi possível consultar agora.';}
 };
 form.addEventListener('submit',event=>{event.preventDefault();void load();});await load();
}
