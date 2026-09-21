(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadLogistics() {
        const container =
            document.querySelector("#logisticsList") ||
            document.querySelector("[data-module='logistics']");

        try {
            const data = await API.get("/logistics");

            const shipments = Array.isArray(data)
                ? data
                : Array.isArray(data.shipments)
                    ? data.shipments
                    : Array.isArray(data.orders)
                        ? data.orders
                        : [];

            if (!container) {
                console.warn("[ADMIN] Container de logística não encontrado.");
                return shipments;
            }

            container.innerHTML = shipments.length
                ? shipments.map(item => `
                    <div class="admin-logistics-item" data-id="${item.id ?? item.order_id ?? ""}">
                        <strong>
                            ${escapeHtml(
                                item.tracking_code ??
                                item.trackingCode ??
                                item.codigo_rastreio ??
                                "Sem rastreio"
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                item.status ??
                                item.shipping_status ??
                                item.status_envio ??
                                "Status não informado"
                            )}
                        </span>
                    </div>
                `).join("")
                : "<p>Nenhum envio encontrado.</p>";

            return shipments;

        } catch (error) {
            console.error("[ADMIN] Erro ao carregar logística:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar a logística.</p>";
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

    window.AdminLogistics = {
        load: loadLogistics
    };

    document.addEventListener("DOMContentLoaded", loadLogistics);
})();
