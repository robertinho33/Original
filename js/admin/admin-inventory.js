(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadInventory() {
        const container =
            document.querySelector("#inventoryList") ||
            document.querySelector("[data-module='inventory']");

        try {
            const data = await API.get("/inventory");

            const items = Array.isArray(data)
                ? data
                : Array.isArray(data.inventory)
                    ? data.inventory
                    : Array.isArray(data.products)
                        ? data.products
                        : [];

            if (!container) {
                console.warn("[ADMIN] Container de estoque não encontrado.");
                return items;
            }

            container.innerHTML = items.length
                ? items.map(item => `
                    <div class="admin-inventory-item" data-id="${item.id ?? item.sku ?? ""}">
                        <strong>${escapeHtml(item.name ?? item.nome ?? item.product_name ?? "Produto")}</strong>
                        <span>Estoque: ${item.stock ?? item.quantity ?? item.estoque ?? 0}</span>
                    </div>
                `).join("")
                : "<p>Nenhum item de estoque encontrado.</p>";

            return items;
        } catch (error) {
            console.error("[ADMIN] Erro ao carregar estoque:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar o estoque.</p>";
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

    window.AdminInventory = {
        load: loadInventory
    };

    document.addEventListener("DOMContentLoaded", loadInventory);
})();
