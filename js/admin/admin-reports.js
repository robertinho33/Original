(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadReports() {
        const container =
            document.querySelector("#reportsList") ||
            document.querySelector("[data-module='reports']");

        try {
            const data = await API.get("/reports");

            const reports = Array.isArray(data)
                ? data
                : Array.isArray(data.reports)
                    ? data.reports
                    : [];

            if (!container) {
                console.warn("[ADMIN] Container de relatórios não encontrado.");
                return reports;
            }

            container.innerHTML = reports.length
                ? reports.map(report => `
                    <div class="admin-report-item" data-id="${report.id ?? ""}">
                        <strong>${escapeHtml(
                            report.name ??
                            report.nome ??
                            report.title ??
                            report.titulo ??
                            "Relatório"
                        )}</strong>

                        <span>${escapeHtml(
                            report.period ??
                            report.periodo ??
                            report.status ??
                            ""
                        )}</span>
                    </div>
                `).join("")
                : "<p>Nenhum relatório encontrado.</p>";

            return reports;

        } catch (error) {
            console.error("[ADMIN] Erro ao carregar relatórios:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar os relatórios.</p>";
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

    window.AdminReports = {
        load: loadReports
    };

    document.addEventListener("DOMContentLoaded", loadReports);
})();
