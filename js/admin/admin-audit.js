(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadAudit() {
        const container =
            document.querySelector("#auditList") ||
            document.querySelector("[data-module='audit']");

        try {
            const data = await API.get("/audit");

            const entries = Array.isArray(data)
                ? data
                : Array.isArray(data.audit)
                    ? data.audit
                    : Array.isArray(data.logs)
                        ? data.logs
                        : [];

            if (!container) {
                console.warn("[ADMIN] Container de auditoria não encontrado.");
                return entries;
            }

            container.innerHTML = entries.length
                ? entries.map(entry => `
                    <div class="admin-audit-item" data-id="${entry.id ?? ""}">
                        <strong>${escapeHtml(
                            entry.action ??
                            entry.acao ??
                            entry.event ??
                            entry.evento ??
                            "Evento"
                        )}</strong>

                        <span>${escapeHtml(
                            entry.user_name ??
                            entry.user ??
                            entry.usuario ??
                            "Sistema"
                        )}</span>

                        <time>${escapeHtml(
                            entry.created_at ??
                            entry.createdAt ??
                            entry.data ??
                            ""
                        )}</time>
                    </div>
                `).join("")
                : "<p>Nenhum registro de auditoria encontrado.</p>";

            return entries;

        } catch (error) {
            console.error("[ADMIN] Erro ao carregar auditoria:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar a auditoria.</p>";
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

    window.AdminAudit = {
        load: loadAudit
    };

    document.addEventListener("DOMContentLoaded", loadAudit);
})();
