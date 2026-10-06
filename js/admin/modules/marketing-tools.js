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

export async function renderStorefront(container) {
    container.innerHTML = '<section class="module-panel"><p>Carregando configurações do banner...</p></section>';
    const [heroResult, accessResult] = await Promise.all([
        api.get('/marketing/hero'), api.get('/access')
    ]);
    const draft = heroResult.data?.draft || {};
    const active = heroResult.data?.active || {};
    const canPublish = accessResult.data?.role === 'admin';
    const value = (key, fallback = '') => esc(draft[key] ?? fallback);
    container.innerHTML = `
      <section class="module-panel">
        <div class="module-panel-header"><div><span class="module-eyebrow">VITRINE</span><h2>Banner principal</h2><p>Prepare uma chamada para promoções e campanhas temporárias.</p></div></div>
        <p class="admin-help-text">${active.title ? `Banner publicado: <strong>${esc(active.title)}</strong>${active.endsAt ? ` · termina em ${esc(date(active.endsAt))}` : ''}.` : 'Ainda não há uma campanha publicada; a vitrine usa o banner padrão.'} Salve primeiro como rascunho e publique quando estiver pronto.</p>
        <form id="storefront-hero-form" class="admin-form">
          <label>Chamada curta<input name="eyebrow" maxlength="80" value="${value('eyebrow', 'BELEZA • CUIDADO • OFERTAS')}"></label>
          <label>Texto principal<input name="title" maxlength="90" required value="${value('title', 'Beleza que')}"></label>
          <label>Palavra em destaque<input name="emphasis" maxlength="60" value="${value('emphasis', 'começa')}"></label>
          <label>Complemento do título<input name="ending" maxlength="90" value="${value('ending', ' no ritual.')}"></label>
          <label class="admin-form-full">Texto da promoção<textarea name="description" maxlength="320" rows="3" required>${value('description', 'Uma experiência especial para o seu ritual de beleza.')}</textarea></label>
          <label>Texto do botão<input name="buttonLabel" maxlength="40" required value="${value('buttonLabel', 'Ver promoção')}"></label>
          <label>Destino do botão<input name="buttonUrl" maxlength="1200" required placeholder="#colecao ou https://..." value="${value('buttonUrl', '#colecao')}"></label>
          <label class="admin-form-full">URL da imagem do banner<input name="imageUrl" maxlength="1200" type="url" placeholder="https://..." value="${value('imageUrl')}"></label>
          <label>Descrição acessível da imagem<input name="imageAlt" maxlength="160" value="${value('imageAlt')}"></label>
          <label>Início da campanha<input name="startsAt" type="datetime-local" value="${dateInput(draft.startsAt)}"></label>
          <label>Fim da campanha<input name="endsAt" type="datetime-local" value="${dateInput(draft.endsAt)}"></label>
          <div class="admin-form-full marketing-form-actions"><button class="admin-button admin-button-primary" type="submit">Salvar rascunho</button><button class="admin-button hero-publish" type="button" ${canPublish ? '' : 'disabled'}>Publicar banner</button><span id="hero-message" role="status"></span></div>
        </form>
      </section>
      <section class="module-panel"><h3>Como aparece na vitrine</h3><div class="marketing-preview"><strong id="hero-preview-title"></strong><p id="hero-preview-description"></p><span id="hero-preview-button" class="admin-status-badge"></span></div></section>`;

    const form = container.querySelector('#storefront-hero-form');
    const message = container.querySelector('#hero-message');
    const syncPreview = () => {
        const values = Object.fromEntries(new FormData(form));
        container.querySelector('#hero-preview-title').textContent = `${values.title || ''} ${values.emphasis || ''}${values.ending || ''}`;
        container.querySelector('#hero-preview-description').textContent = values.description || '';
        container.querySelector('#hero-preview-button').textContent = values.buttonLabel || '';
    };
    form.addEventListener('input', syncPreview);
    syncPreview();
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(form));
        body.startsAt = body.startsAt ? new Date(body.startsAt).toISOString() : '';
        body.endsAt = body.endsAt ? new Date(body.endsAt).toISOString() : '';
        try {
            await api.put('/marketing/hero', body);
            message.textContent = 'Rascunho salvo.';
        } catch (error) { message.textContent = error.message; }
    });
    container.querySelector('.hero-publish').addEventListener('click', async () => {
        if (!canPublish) return;
        try {
            await api.put('/marketing/hero/activate', {});
            message.textContent = 'Banner publicado na vitrine.';
            await renderStorefront(container);
        } catch (error) { message.textContent = error.message; }
    });
}

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
        const subject = encodeURIComponent('Um incentivo especial NEFER');
        lastAudience = rows;
        preview.innerHTML = `<div class="marketing-preview-summary"><p><strong>${rows.length} participante(s)</strong> atendem aos filtros atuais.</p>${rows.length ? '<button type="button" class="admin-button" id="download-audience">Baixar lista completa (CSV)</button>' : ''}</div>${rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>Contato</th><th>Pedidos</th><th>Vendas pagas</th><th>Comissão</th><th>Última atividade</th><th>Contato manual</th></tr></thead><tbody>${rows.slice(0, 15).map(row => {
            const phone = String(row.phone || '').replace(/\D/g, '');
            const whatsappPhone = phone && (phone.startsWith('55') ? phone : `55${phone}`);
            const message = encodeURIComponent(`Olá ${row.name}, temos um incentivo especial NEFER para você: ${offer}`);
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
            anchor.download = 'publico-campanha-nefer.csv';
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
