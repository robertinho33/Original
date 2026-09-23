import { waitForAuthorizedAdmin } from "../auth/admin-guard.js";
import { listCategories } from "./category-repository.js";

const result = document.getElementById("categoryList");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderCategories(categories) {
    if (!categories.length) {
        result.innerHTML = `
            <div class="empty-state">
                Nenhuma categoria cadastrada.
            </div>
        `;
        return;
    }

    result.innerHTML = categories.map(category => `
        <article class="category-card">
            <div>
                <strong>${escapeHtml(category.name)}</strong>
                <p>${escapeHtml(category.description || "")}</p>
            </div>

            <span>
                Ordem: ${escapeHtml(category.sortOrder ?? 0)}
            </span>
        </article>
    `).join("");
}

async function init() {
    result.textContent = "Autenticando administrador...";

    try {
        await waitForAuthorizedAdmin();

        result.textContent = "Carregando categorias...";

        const categories = await listCategories();

        console.log("[AUREA] Categorias carregadas:", categories);

        renderCategories(categories);
    } catch (error) {
        console.error("[AUREA] Erro ao carregar categorias:", error);

        result.innerHTML = `
            <div class="error-state">
                <strong>Erro ao carregar categorias</strong>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

init();