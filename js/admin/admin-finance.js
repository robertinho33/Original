(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadFinance() {
        const container =
            document.querySelector("#financeList") ||
            document.querySelector("[data-module='finance']");

        try {
            const data = await API.get("/finance");

            const entries = Array.isArray(data)
                ? data
                : Array.isArray(data.finance)
                    ? data.finance
                    : Array.isArray(data.transactions)
                        ? data.transactions
                        : [];

            if (!container) {
                console.warn("[ADMIN] Container financeiro não encontrado.");
                return entries;
            }

            container.innerHTML = entries.length
                ? entries.map(entry => `
                    <div class="admin-finance-item" data-id="${entry.id ?? ""}">
                        <strong>${escapeHtml(entry.description ?? entry.descricao ?? "Movimentação")}</strong>
                        <span>${formatCurrency(entry.amount ?? entry.valor ?? 0)}</span>
                    </div>
                `).join("")
                : "<p>Nenhuma movimentação encontrada.</p>";

            return entries;
        } catch (error) {
            console.error("[ADMIN] Erro ao carregar financeiro:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar o financeiro.</p>";
            }

            return [];
        }
    }

    function formatCurrency(value) {
        const number = Number(value) || 0;

        return number.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.AdminFinance = {
        load: loadFinance
    };

    document.addEventListener("DOMContentLoaded", loadFinance);
})();
