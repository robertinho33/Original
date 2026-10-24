import {getAdminIdToken} from '../../auth/admin-auth.js';
export async function renderStoreVisits(root) {
    const section=document.createElement('section'); section.className='module-panel';
    const title=document.createElement('h2'); title.textContent='Visitas à loja';
    const content=document.createElement('div'); content.className='admin-metrics-grid'; content.setAttribute('aria-live','polite'); content.textContent='Carregando visitas…';
    const note=document.createElement('p'); note.textContent='Sessões com aceite de estatísticas. Uma visita por aba a cada 30 minutos; recarregar não soma outra visita. Contagem própria desde a ativação, pode diferir do Google Analytics. Indicadores atualizados em até dois minutos.';
    const refresh=document.createElement('button'); refresh.type='button'; refresh.className='admin-primary-button'; refresh.textContent='Atualizar visitas';
    section.append(title,content,note,refresh); root.prepend(section);
    async function load() {
        refresh.disabled=true;
        try {
            const token=await getAdminIdToken(false);
            const response=await fetch('/api/admin/store-visits',{headers:{Authorization:'Bearer '+token}});
            const payload=await response.json();
            if(!response.ok) {if(response.status===401)throw Error('Sua sessão precisa ser renovada. Entre novamente no painel.');throw Error(payload.error||'Visitas temporariamente indisponíveis. Tente atualizar.');}
            const {data}=payload;
            content.replaceChildren();
            for(const [label,value] of [['Visitas hoje',data.today],['Últimos 30 dias',data.last30Days],['Total de visitas',data.total]]) {
                const card=document.createElement('article'); card.className='admin-metric-card';
                const caption=document.createElement('span'); caption.textContent=label;
                const number=document.createElement('strong'); number.textContent=Number(value).toLocaleString('pt-BR');
                card.append(caption,number); content.append(card);
            }
        } catch(error) { content.textContent=error.message||'Visitas temporariamente indisponíveis. Tente atualizar.'; }
        finally {refresh.disabled=false;}
    }
    refresh.addEventListener('click',load); await load();
}
