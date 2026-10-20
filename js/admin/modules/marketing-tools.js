import { renderStorefrontWorkspace } from './storefront-workspace.js';
import { renderRitualTools } from './discovery-tools.js';
import { renderInfluencerCampaign } from './influencer-campaign.js';
const api = window.AdminAPI;
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const brl = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
const dateInput = value => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function filtersFrom(form) {
    const data = new FormData(form);
    return {
        minOrders: Number(data.get('minOrders') || 0),
        minSpend: Number(data.get('minSpend') || 0),
        minCommission: Number(data.get('minCommission') || 0),
        inactiveDays: Number(data.get('inactiveDays') || 0),
        activeOnly: data.get('activeOnly') === 'on'
    };
}

export async function renderStorefront(container) { return renderStorefrontWorkspace(container); }

export async function renderIncentiveCampaigns(container) {
    container.innerHTML = '<section class="module-panel"><p>Carregando públicos e campanhas...</p></section>';
    const [campaignResult, accessResult] = await Promise.all([api.get('/marketing/campaigns'), api.get('/access')]);
    const campaigns = campaignResult.data || [];
    const canActivate = accessResult.data?.role === 'admin';
    container.innerHTML = `
      <section class="module-panel">
        <div class="module-panel-header"><div><span class="module-eyebrow">RELACIONAMENTO</span><h2>Campanhas de incentivo</h2><p>Segmente clientes e influenciadores com base nas movimentações registradas.</p></div></div>
        <p class="admin-help-text">O histórico usa pedidos, pagamentos, cupons e comissões registrados. Ativar uma campanha salva seu público e histórico; não envia mensagens automaticamente.</p>
        <form id="incentive-campaign-form" class="admin-form">
          <label>Nome da campanha<input name="title" required maxlength="120" placeholder="Ex.: Volte para sua rotina de cuidados"></label>
          <label>Público<select name="targetType"><option value="customers">Clientes</option><option value="influencers">Influenciadores</option></select></label>
          <label>Pedido(s) pagos no mínimo<input name="minOrders" type="number" min="0" value="0"></label>
          <label>Sem movimentação há (dias)<input name="inactiveDays" type="number" min="0" value="0"><small>0 considera todos os períodos.</small></label>
          <label>Compras pagas mínimas<input name="minSpend" type="number" min="0" step="0.01" value="0"></label>
          <label>Comissão mínima acumulada<input name="minCommission" type="number" min="0" step="0.01" value="0"><small>Usado ao selecionar influenciadores.</small></label>
          <label class="admin-form-full">Incentivo oferecido<input name="benefit" required maxlength="240" placeholder="Ex.: cupom VOLTE10 com 10% de desconto"></label>
          <label class="admin-form-full">Mensagem / observações<textarea name="description" maxlength="800" rows="3" placeholder="Objetivo, validade e instruções para a equipe."></textarea></label>
          <label class="marketing-check admin-form-full"><input type="checkbox" name="activeOnly" checked> Incluir apenas influenciadores ativos</label>
          <div class="admin-form-full marketing-form-actions"><button class="admin-button" id="audience-preview" type="button">Pré-visualizar público</button><button class="admin-button admin-button-primary" type="submit">Salvar campanha como rascunho</button><span id="campaign-message" role="status"></span></div>
        </form>
        <div id="audience-preview-result" class="marketing-audience-preview" aria-live="polite"></div>
      </section>
      <section class="module-panel"><div class="module-panel-header"><h3>Campanhas registradas</h3></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Campanha</th><th>Público</th><th>Incentivo</th><th>Participantes</th><th>Status e histórico</th><th>Ação</th></tr></thead><tbody>
        ${campaigns.length ? campaigns.map(item => `<tr><td><strong>${esc(item.title)}</strong><small>${esc(item.description || '')}</small></td><td>${item.targetType === 'customers' ? 'Clientes' : 'Influenciadores'}</td><td>${esc(item.benefit)}</td><td>${Number(item.audienceCount || 0)}</td><td>${item.status === 'active' ? `Ativa desde ${esc(date(item.activatedAt))} por ${esc(item.activatedBy)}` : `Rascunho criado ${esc(date(item.createdAt))} por ${esc(item.createdBy)}`}<details><summary>Histórico (${(item.history || []).length})</summary><ul>${(item.history || []).map(event => `<li>${esc(event.type)} · ${esc(date(event.at))} · ${esc(event.actor)} · ${Number(event.audienceCount || 0)} participante(s)</li>`).join('')}</ul></details></td><td>${item.status !== 'active' && canActivate ? `<button class="admin-button campaign-launch" data-id="${esc(item.id)}" type="button">Ativar campanha</button>` : '—'}</td></tr>`).join('') : '<tr><td colspan="6">Nenhuma campanha cadastrada.</td></tr>'}
      </tbody></table></div></section>`;

    const form = container.querySelector('#incentive-campaign-form');
    const message = container.querySelector('#campaign-message');
    const preview = container.querySelector('#audience-preview-result');
    let lastAudience = [];
    container.querySelector('[name="targetType"]').addEventListener('change', event => {
        const influencerOnly = event.target.value === 'influencers';
        const commission = form.querySelector('[name="minCommission"]').closest('label');
        commission.hidden = !influencerOnly;
        form.querySelector('[name="activeOnly"]').closest('label').hidden = !influencerOnly;
    });
    container.querySelector('[name="targetType"]').dispatchEvent(new Event('change', { bubbles: false }));

    const renderAudience = rows => {
        const offer = form.elements.benefit.value.trim();
        const subject = encodeURIComponent('Um incentivo especial Fios Perfeitos');
        lastAudience = rows;
        preview.innerHTML = `<div class="marketing-preview-summary"><p><strong>${rows.length} participante(s)</strong> atendem aos filtros atuais.</p>${rows.length ? '<button type="button" class="admin-button" id="download-audience">Baixar lista completa (CSV)</button>' : ''}</div>${rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>Contato</th><th>Pedidos</th><th>Vendas pagas</th><th>Comissão</th><th>Última atividade</th><th>Contato manual</th></tr></thead><tbody>${rows.slice(0, 15).map(row => {
            const phone = String(row.phone || '').replace(/\D/g, '');
            const whatsappPhone = phone && (phone.startsWith('55') ? phone : `55${phone}`);
            const message = encodeURIComponent(`Olá ${row.name}, temos um incentivo especial Fios Perfeitos para você: ${offer}`);
            const contact = row.email ? `<a href="mailto:${encodeURIComponent(row.email)}?subject=${subject}&body=${message}">E-mail</a>` : '';
            const whatsapp = whatsappPhone ? `<a href="https://wa.me/${esc(whatsappPhone)}?text=${message}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : '';
            return `<tr><td>${esc(row.name)}</td><td>${esc(row.email || row.phone || '—')}</td><td>${Number(row.orderCount || 0)}</td><td>${brl(row.spend)}</td><td>${brl(row.commission)}</td><td>${esc(date(row.lastActivityAt))}</td><td>${[contact, whatsapp].filter(Boolean).join(' · ') || '—'}</td></tr>`;
        }).join('')}</tbody></table></div>${rows.length > 15 ? `<small>Exibindo os primeiros 15 de ${rows.length} participantes. Refine os filtros para uma seleção menor.</small>` : ''}` : ''}`;
        preview.querySelector('#download-audience')?.addEventListener('click', () => {
            const csvValue = value => {
                let cell = String(value ?? '');
                if (/^[=+@\-]/.test(cell)) cell = `'${cell}`;
                return `"${cell.replaceAll('"', '""')}"`;
            };
            const headers = ['Nome', 'E-mail', 'Telefone', 'Pedidos', 'Vendas pagas', 'Comissão', 'Última atividade'];
            const lines = [headers, ...lastAudience.map(row => [row.name, row.email, row.phone, row.orderCount, row.spend, row.commission, row.lastActivityAt])]
                .map(row => row.map(csvValue).join(';')).join('\r\n');
            const blob = new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'publico-campanha-fios-perfeitos.csv';
            anchor.click();
            URL.revokeObjectURL(url);
        });
    };
    container.querySelector('#audience-preview').addEventListener('click', async () => {
        const data = new FormData(form);
        try {
            const result = await api.post('/marketing/audience', { targetType: data.get('targetType'), filters: filtersFrom(form) });
            renderAudience(result.data || []);
            message.textContent = '';
        } catch (error) { preview.textContent = ''; message.textContent = error.message; }
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const data = new FormData(form);
        try {
            await api.post('/marketing/campaigns', {
                title: data.get('title'), targetType: data.get('targetType'), benefit: data.get('benefit'), description: data.get('description'), filters: filtersFrom(form)
            });
            await renderIncentiveCampaigns(container);
        } catch (error) { message.textContent = error.message; }
    });
    container.querySelectorAll('.campaign-launch').forEach(button => button.addEventListener('click', async () => {
        try {
            await api.put(`/marketing/campaigns/${encodeURIComponent(button.dataset.id)}/launch`, {});
            await renderIncentiveCampaigns(container);
        } catch (error) { window.alert(error.message); }
    }));
}
