"use strict";

const api = window.AdminAPI;
const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export async function renderRelationships(container) {
    container.innerHTML = `<div class="module-panel"><p>Carregando vínculos e vendas...</p></div>`;
    const result = await api.get("/partnerships/overview");
    if (!result?.success) throw new Error(result?.error || "Não foi possível carregar os relacionamentos.");
    const data = result.data || {};
    const partners = data.influencers || [];
    const orders = data.attributedOrders || [];
    const countOrders = partners.reduce((sum, item) => sum + Number(item.orderCount || 0), 0);
    const countPaid = partners.reduce((sum, item) => sum + Number(item.paidOrders || 0), 0);
    const revenue = partners.reduce((sum, item) => sum + Number(item.paidRevenue || 0), 0);
    const commission = partners.reduce((sum, item) => sum + Number(item.commissionEarned || 0), 0);
    container.innerHTML = `
      <section class="module-panel">
        <div class="module-panel-header"><div><span class="module-eyebrow">PARCERIAS</span><h2>Relacionamentos</h2><p>Veja quais cupons geraram pedidos e quanto foi atribuído a cada influenciador.</p></div></div>
        <div class="admin-metrics-grid">
          <article class="admin-metric-card"><span class="metric-label">Pedidos atribuídos</span><div class="metric-value">${countOrders}</div></article>
          <article class="admin-metric-card"><span class="metric-label">Pedidos pagos</span><div class="metric-value">${countPaid}</div></article>
          <article class="admin-metric-card"><span class="metric-label">Faturamento pago atribuído</span><div class="metric-value">${money(revenue)}</div></article>
          <article class="admin-metric-card"><span class="metric-label">Comissão estimada</span><div class="metric-value">${money(commission)}</div></article>
        </div>
        <p class="admin-help-text">${esc(data.reconciliationNote || "Comissões são estimativas calculadas a partir dos pedidos pagos.")}</p>
      </section>
      <section class="module-panel"><div class="module-panel-header"><h3>Por influenciador</h3></div>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Influenciador</th><th>Cupons</th><th>Pedidos pagos</th><th>Faturamento</th><th>Comissão estimada</th></tr></thead><tbody>
          ${partners.length ? partners.map(p => `<tr><td>${esc(p.influencerName)}${p.active === false ? " · Inativo" : ""}</td><td>${(p.coupons || []).map(c => `<span class="admin-status-badge">${esc(c.code)}${c.active ? "" : " (inativo)"}</span>`).join(" ") || "—"}</td><td>${Number(p.paidOrders || 0)} <small>(${Number(p.pendingOrders || 0)} pendentes)</small></td><td>${money(p.paidRevenue)}</td><td>${money(p.commissionEarned)}</td></tr>`).join("") : `<tr><td colspan="5">Cadastre influenciadores e vincule-os aos cupons para acompanhar as vendas.</td></tr>`}
        </tbody></table></div>
      </section>
      <section class="module-panel"><div class="module-panel-header"><h3>Pedidos atribuídos</h3></div>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Pedido</th><th>Data</th><th>Influenciador</th><th>Cupom</th><th>Pagamento</th><th>Venda</th><th>Comissão</th></tr></thead><tbody>
        ${orders.length ? orders.map(o => `<tr><td>${esc(o.orderId)}</td><td>${o.createdAt ? esc(new Date(o.createdAt).toLocaleDateString("pt-BR")) : "—"}</td><td>${esc(o.influencerName)}</td><td>${esc(o.couponCode)}</td><td>${esc(o.paymentStatus)}</td><td>${money(o.orderTotal)}</td><td>${o.commissionBasisAvailable ? `${money(o.commissionAmount)} (${Number(o.commissionRate || 0)}%)` : "Base indisponível"}</td></tr>`).join("") : `<tr><td colspan="7">Nenhum pedido atribuído encontrado.</td></tr>`}
        </tbody></table></div>
      </section>`;
}

export async function renderContracts(container) {
    container.innerHTML = `<div class="module-panel"><p>Carregando contratos...</p></div>`;
    const [influencerResult, contractResult, accessResult] = await Promise.all([api.influencers(), api.get("/contracts"), api.get("/access")]);
    if (!influencerResult?.success || !contractResult?.success || !accessResult?.success) throw new Error("Não foi possível carregar os influenciadores e contratos.");
    const influencers = influencerResult.data || [];
    const contracts = contractResult.data || [];
    const canManageContracts = accessResult?.data?.role === "admin";
    container.innerHTML = `
      <section class="module-panel"><div class="module-panel-header"><div><span class="module-eyebrow">PARCERIAS</span><h2>Contratos</h2><p>Registre termos, comissão e período da parceria em um só lugar.</p></div></div>
      <div class="admin-help-text">A ativação exige confirmação do aceite e fica registrada com data e responsável. Colaboradores podem preparar rascunhos; o administrador confirma o aceite antes de ativar. Este módulo organiza o contrato, mas não realiza assinatura eletrônica.</div>
      <form id="partnership-contract-form" class="admin-form">
        <label>Influenciador<select name="influencerId" required><option value="">Selecione</option>${influencers.filter(p => p.active !== false).map(p => `<option value="${esc(p.id)}" data-rate="${Number(p.commissionDefault || 0)}">${esc(p.name)}</option>`).join("")}</select></label>
        <label>Título do contrato<input name="title" maxlength="120" required placeholder="Ex.: Parceria de divulgação — 2026"></label>
        <label>Comissão (%)<input name="commissionRate" type="number" min="0" max="100" step="0.01" required value="${Number(influencers[0]?.commissionDefault || 0)}"></label>
        <label>Início da vigência<input name="startAt" type="date"></label><label>Fim da vigência<input name="endAt" type="date"></label>
        <label class="admin-form-full">Termos acordados<textarea name="terms" maxlength="8000" rows="6" required placeholder="Descreva responsabilidades, forma de cálculo, prazo de pagamento e demais condições acordadas."></textarea></label>
        <div class="admin-form-full"><button class="admin-button admin-button-primary" type="submit" ${influencers.length ? "" : "disabled"}>Salvar como rascunho</button><span id="contract-message" role="status"></span></div>
      </form></section>
      <section class="module-panel"><div class="module-panel-header"><h3>Histórico de contratos</h3></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Contrato</th><th>Influenciador</th><th>Comissão</th><th>Vigência</th><th>Status</th><th>Registro</th><th>Ações</th></tr></thead><tbody>
      ${contracts.length ? contracts.map(c => `<tr><td><strong>${esc(c.title)}</strong><details><summary>Ver termos</summary><p>${esc(c.terms)}</p></details></td><td>${esc(c.influencerName)}</td><td>${Number(c.commissionRate || 0)}%</td><td>${esc(c.startAt || "—")} a ${esc(c.endAt || "sem data final")}</td><td>${c.status === "active" ? "Ativo" : c.status === "ended" ? "Encerrado" : "Rascunho"}</td><td>${c.status === "active" ? `Ativado em ${esc(c.activatedAt || "—")} por ${esc(c.activatedBy || "—")}` : `Criado em ${esc(c.createdAt || "—")} por ${esc(c.createdBy || "—")}`}</td><td>${c.status === "draft" && canManageContracts ? `<button class="admin-button contract-activate" data-id="${esc(c.id)}" type="button">Ativar</button>` : c.status === "active" && canManageContracts ? `<button class="admin-button contract-end" data-id="${esc(c.id)}" type="button">Encerrar</button>` : "—"}</td></tr>`).join("") : `<tr><td colspan="7">Nenhum contrato registrado. Comece salvando um rascunho acima.</td></tr>`}
      </tbody></table></div></section>`;
    const message = container.querySelector("#contract-message");    const influencerSelect = container.querySelector('#partnership-contract-form [name="influencerId"]');    const rateInput = container.querySelector('#partnership-contract-form [name="commissionRate"]');    influencerSelect?.addEventListener("change", () => { rateInput.value = influencerSelect.selectedOptions[0]?.dataset.rate || "0"; });
    container.querySelector("#partnership-contract-form")?.addEventListener("submit", async event => {
        event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form));
        try { const result = await api.post("/contracts", body); if (!result?.success) throw new Error(result?.error || "Não foi possível salvar."); await renderContracts(container); }
        catch(error) { message.textContent = error.message; }
    });
    container.querySelectorAll(".contract-activate").forEach(button => button.addEventListener("click", async () => {
        if (!window.confirm("Confirma que o influenciador e a empresa revisaram e aceitaram estes termos? A confirmação será registrada no histórico.")) return;
        try { const result = await api.put(`/contracts/${encodeURIComponent(button.dataset.id)}/activate`, { confirmReviewed: true }); if (!result?.success) throw new Error(result?.error || "Não foi possível ativar."); await renderContracts(container); }
        catch(error) { window.alert(error.message); }
    }));
    container.querySelectorAll(".contract-end").forEach(button => button.addEventListener("click", async () => {
        if (!window.confirm("Deseja encerrar este contrato? O registro permanecerá no histórico.")) return;
        try { const result = await api.put(`/contracts/${encodeURIComponent(button.dataset.id)}/end`, {}); if (!result?.success) throw new Error(result?.error || "Não foi possível encerrar."); await renderContracts(container); }
        catch(error) { window.alert(error.message); }
    }));
}





