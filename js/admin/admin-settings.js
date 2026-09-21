(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadSettings() {
        const container =
            document.querySelector("#settingsList") ||
            document.querySelector("[data-module='settings']");

        try {
            const data = await API.get("/settings");

            const settings = Array.isArray(data)
                ? data
                : Array.isArray(data.settings)
                    ? data.settings
                    : data.settings && typeof data.settings === "object"
                        ? Object.entries(data.settings).map(([key, value]) => ({
                            key,
                            value
                        }))
                        : [];

            if (!container) {
                console.warn("[ADMIN] Container de configurações não encontrado.");
                return settings;
            }

            container.innerHTML = settings.length
                ? settings.map(setting => `
                    <div class="admin-setting-item" data-key="${escapeHtml(
                        setting.key ??
                        setting.name ??
                        setting.nome ??
                        ""
                    )}">
                        <strong>${escapeHtml(
                            setting.label ??
                            setting.name ??
                            setting.nome ??
                            setting.key ??
                            "Configuração"
                        )}</strong>

                        <span>${escapeHtml(
                            setting.value ??
                            setting.valor ??
                            ""
                        )}</span>
                    </div>
                `).join("")
                : "<p>Nenhuma configuração encontrada.</p>";

            return settings;

        } catch (error) {
            console.error("[ADMIN] Erro ao carregar configurações:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar as configurações.</p>";
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

    window.AdminSettings = {
        load: loadSettings
    };

    document.addEventListener("DOMContentLoaded", loadSettings);
})();
