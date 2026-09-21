/**
 * AUREA ADMIN — CATEGORIAS
 * Camada de integração do módulo de categorias.
 */
(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadCategories() {
        const container =
            document.querySelector("#categoriesList") ||
            document.querySelector("[data-module='categories']");

        try {
            const data = await API.get("/categories");

            const categories = Array.isArray(data)
                ? data
                : Array.isArray(data.categories)
                    ? data.categories
                    : [];

            if (!container) {
                console.warn("[ADMIN] Container de categorias não encontrado.");
                return categories;
            }

            container.innerHTML = categories.length
                ? categories.map(category => `
                    <div class="admin-category-item" data-id="${category.id ?? ""}">
                        <span>${escapeHtml(category.name ?? category.nome ?? "Sem nome")}</span>
                    </div>
                `).join("")
                : "<p>Nenhuma categoria encontrada.</p>";

            return categories;
        } catch (error) {
            console.error("[ADMIN] Erro ao carregar categorias:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar as categorias.</p>";
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

    window.AdminCategories = {
        load: loadCategories
    };

    document.addEventListener("DOMContentLoaded", () => {
        loadCategories();
    });
})();
