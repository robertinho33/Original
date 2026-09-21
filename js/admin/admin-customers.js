(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadCustomers() {
        const container =
            document.querySelector("#customersList") ||
            document.querySelector("[data-module='customers']");

        try {
            const data = await API.get("/customers");

            const customers = Array.isArray(data)
                ? data
                : Array.isArray(data.customers)
                    ? data.customers
                    : [];

            if (!container) {
                console.warn("[ADMIN] Container de clientes não encontrado.");
                return customers;
            }

            container.innerHTML = customers.length
                ? customers.map(customer => `
                    <div class="admin-customer-item" data-id="${customer.id ?? ""}">
                        <strong>${escapeHtml(customer.name ?? customer.nome ?? "Cliente")}</strong>
                        <span>${escapeHtml(customer.email ?? "")}</span>
                    </div>
                `).join("")
                : "<p>Nenhum cliente encontrado.</p>";

            return customers;
        } catch (error) {
            console.error("[ADMIN] Erro ao carregar clientes:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar os clientes.</p>";
            }

            return [];
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.AdminCustomers = {
        load: loadCustomers
    };

    document.addEventListener("DOMContentLoaded", loadCustomers);
})();
