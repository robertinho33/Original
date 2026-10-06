"use strict";

const api = window.AdminAPI;
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = value => value ? new Date(value).toLocaleString("pt-BR") : "—";

export async function renderCommissionLedger(container) {
    const access = await api.get("/access");
    const canPay = access?.data?.role === "admin";
    container.innerHTML = `<section class="module-panel"><p>Carregando comissões...</p></section>`;
    let automaticSync = null;
    if (canPay) {
        try {
            const syncResult = await api.post("/commissions/sync", {});
            if (syncResult?.success) automaticSync = syncResult.data || {};
        } catch (error) {
            automaticSync = { error: error.message || "A atualização automática falhou." };
        }
    }
    const result = await api.get("/commissions");
    if (!result?.success) throw new Error(result?.error || "Não foi possível carregar as comissões.");
    const items = result.data || [];
    const pending = items.filter(item => item.status === "pending");
    const paid = items.filter(item => item.status === "paid" || (item.status === "review_required" && item.previousStatus === "paid"));
    const voided = items.filter(item => item.status === "void");
    const review = items.filter(item => item.status === "review_required");
    const total = list => list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    container.innerHTML = `
      <section class="module-panel">
        <div class="module-panel-header"><div><span class="module-eyebrow">PARCERIAS</span><h2>Comissões</h2><p>Pedidos pagos são conciliados automaticamente ao abrir esta tela e após a confirmação no Admin.</p></div>${canPay ? `<button type="button" id="commission-sync" class="admin-button admin-button-primary">Atualizar conciliação</button>` : ""}</div>
        <p class="admin-help-text">Cada comissão registra o pedido, a taxa e a base usadas na conciliação. O pagamento exige referência. Estornos posteriores ficam sinalizados para revisão; vendas sem dados de cupom aparecem na lista para conferência e não geram repasse até serem identificadas.</p>
        <div id="commission-message" role="status"></div>
        <div class="admin-metrics-grid">
          <article class="admin-metric-card"><span class="metric-label">A pagar</span><div class="metric-value">${money(total(pending))}</div><div class="metric-detail">${pending.length} pedido(s)</div></article>
          <article class="admin-metric-card"><span class="metric-label">Pagas</span><div class="metric-value">${money(total(paid))}</div><div class="metric-detail">${paid.length} comissão(ões)</div></article>
          <article class="admin-metric-card"><span class="metric-label">Anuladas</span><div class="metric-value">${money(total(voided))}</div><div class="metric-detail">${voided.length} registro(s)</div></article>
          <article class="admin-metric-card"><span class="metric-label">Precisam de revisão</span><div class="metric-value">${review.length}</div><div class="metric-detail">Não são removidas do histórico</div></article>
        </div>
      </section>
      <section class="module-panel"><div class="module-panel-header"><h3>Livro de comissões</h3></div>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Pedido</th><th>Influenciador</th><th>Cupom</th><th>Base e taxa</th><th>Comissão</th><th>Status</th><th>Pagamento / ação</th></tr></thead><tbody>
          ${items.length ? items.map(item => {
            const status = item.status === "pending" ? "A pagar" : item.status === "paid" ? "Paga" : item.status === "void" ? "Anulada" : "Revisar";
            const paidInfo = item.paidAt ? `${date(item.paidAt)} · ${esc(item.paidBy)} · ref. ${esc(item.paymentReference)}` : item.reviewReason ? esc(item.reviewReason) : "—";
            const action = canPay && item.status === "pending" ? `<button type="button" class="admin-button commission-pay" data-id="${esc(item.id)}">Registrar pagamento</button>` : paidInfo;
            return `<tr><td>${esc(item.orderId)}<small>${esc(item.orderDocumentId)}</small></td><td>${esc(item.influencerName)}</td><td>${esc(item.couponCode || "—")}</td><td>${money(item.commissionBase)} × ${Number(item.commissionRate || 0)}%<small>${esc(item.commissionRateSource || "Taxa registrada")}${item.contractTitle ? `: ${esc(item.contractTitle)}` : ""}</small></td><td><strong>${money(item.amount)}</strong></td><td>${status}${item.reviewReason ? `<small>${esc(item.reviewReason)}</small>` : ""}</td><td>${action}</td></tr>`;
          }).join("") : `<tr><td colspan="7">Ainda não há comissões registradas. ${canPay ? "Concilie pedidos pagos. Se a venda usar cupom sem influenciador vinculado, edite o cupom em Cupons e concilie novamente." : "Aguarde o administrador conciliar os pedidos pagos."}</td></tr>`}
        </tbody></table></div>
      </section>`;

    const initialMessage = container.querySelector("#commission-message");
    if (initialMessage && automaticSync?.error) {
        initialMessage.textContent = automaticSync.error;
    } else if (initialMessage && automaticSync) {
        const unlinkedCount = automaticSync.unlinkedPaidOrders || 0;
        const missingIds = (automaticSync.missingCouponData || []).map(item => item.orderId);
        initialMessage.textContent = "Conciliação atualizada ao abrir a tela." +
            (unlinkedCount ? " " + unlinkedCount + " venda(s) paga(s) aguardam identificação do cupom/influenciador." : "") +
            (missingIds.length ? " Sem dados do cupom: " + missingIds.join(", ") + ". Estas vendas estão em revisão e não podem gerar repasse até a identificação." : "");
    }

    container.querySelector("#commission-sync")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const response = await api.post("/commissions/sync", {});
            if (!response?.success) throw new Error(response?.error || "A conciliação falhou.");
            const report = response.data || {};
            await renderCommissionLedger(container);
            const message = container.querySelector("#commission-message");
            if (message) message.textContent = `Conciliação concluída: ${report.created || 0} comissão(ões) nova(s), ${report.voided || 0} anulada(s), ${report.reviewRequired || 0} para revisão.${report.skippedWithoutBase ? ` ${report.skippedWithoutBase} pedido(s) sem subtotal foram ignorados.` : ""}`;
            if (message && report.unlinkedPaidOrders) {
                message.textContent += " " + report.unlinkedPaidOrders + " venda(s) paga(s) com desconto sem vínculo de cupom/influenciador." + (report.unlinkedCoupons?.length ? " Cupons sem vínculo: " + report.unlinkedCoupons.join(", ") + "." : "") + " Confira os pedidos sinalizados antes de registrar repasses.";
            }
            if (message && report.missingCouponData?.length) {
                message.textContent += " Dados do cupom não foram salvos em: " + report.missingCouponData.map(item => item.orderId + (item.discount ? " (desconto " + money(item.discount) + ")" : "")).join(", ") + ". O sistema não consegue identificar o influenciador automaticamente; confirme o cupom usado antes de criar o repasse.";
            }
        } catch (error) {
            button.disabled = false;
            const message = container.querySelector("#commission-message");
            if (message) message.textContent = error.message;
        }
    });

    container.querySelectorAll(".commission-pay").forEach(button => button.addEventListener("click", async () => {
        const reference = window.prompt("Informe a referência do pagamento (por exemplo, ID da transferência ou comprovante):");
        if (!reference?.trim()) return;
        if (!window.confirm(`Registrar ${money(items.find(item => item.id === button.dataset.id)?.amount)} como paga com a referência informada?`)) return;
        button.disabled = true;
        try {
            const response = await api.put(`/commissions/${encodeURIComponent(button.dataset.id)}/paid`, { paymentReference: reference.trim() });
            if (!response?.success) throw new Error(response?.error || "Não foi possível registrar o pagamento.");
            await renderCommissionLedger(container);
        } catch (error) {
            button.disabled = false;
            window.alert(error.message);
        }
    }));
}
