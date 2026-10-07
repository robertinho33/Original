"use strict";

const api = window.AdminAPI;
const escapeHtml = value => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

function showMessage(message, isError = false) {
    const target = document.getElementById("adminSupplierMessage");
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("is-error", isError);
    target.hidden = false;
}

export function renderSupplierManager(container, suppliers = []) {
    const sourceOptions = suppliers.map(source => `<option value="${escapeHtml(source.id)}">${escapeHtml(source.name)}${source.visible === false ? " — oculto na vitrine" : ""}</option>`).join("");
    const supplierCards = suppliers.length ? suppliers.map(source => `
        <article class="admin-supplier-card">
            <div><strong>${escapeHtml(source.name || source.id)}</strong><span>ID: ${escapeHtml(source.id)}</span>
                ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">Site do fornecedor</a>` : ""}
            </div>
            <div class="admin-supplier-actions">
                <span class="admin-supplier-badge ${source.visible === false ? "is-hidden" : ""}">${source.visible === false ? "Oculto na vitrine" : "Visível na vitrine"}</span>
                ${source.fileName ? `<button type="button" class="admin-action-button" data-import-source-id="${escapeHtml(source.id)}" data-source-file="${escapeHtml(source.fileName)}">Importar CSV cadastrado</button>` : `<span class="admin-supplier-badge">Envie o CSV abaixo</span>`}
            </div>
        </article>`).join("") : `<p>Nenhum fornecedor cadastrado.</p>`;

    container.innerHTML = `
        <section class="admin-supplier-module">
            <div class="admin-supplier-intro">
                <h3>Portfólio de fornecedores</h3>
                <p>Cadastre uma fonte e importe o CSV. O arquivo é validado por SKU, nome e preço antes de gravar os produtos.</p>
            </div>
            <div id="adminSupplierMessage" class="admin-supplier-message" role="status" hidden></div>
            <div class="admin-supplier-grid">
                <form id="adminSupplierCreateForm" class="admin-supplier-panel">
                    <h4>Novo fornecedor</h4>
                    <label>Identificador <input name="id" required minlength="2" maxlength="48" pattern="[a-z0-9][a-z0-9-]+" placeholder="ex.: fornecedor-novo"></label>
                    <label>Nome comercial <input name="name" required maxlength="120" placeholder="Nome do fornecedor"></label>
                    <label>Site oficial <input name="url" type="url" maxlength="500" placeholder="https://"></label>
                    <button type="submit" class="admin-primary-button">Cadastrar fornecedor</button>
                </form>
                <form id="adminSupplierImportForm" class="admin-supplier-panel">
                    <h4>Importar catálogo CSV</h4>
                    <label>Fornecedor <select name="supplierId" required>${sourceOptions || '<option value="">Cadastre um fornecedor primeiro</option>'}</select></label>
                    <label>Arquivo CSV <input name="catalogFile" type="file" accept=".csv,text/csv" required></label>
                    <p>Colunas aceitas: SKU, nome, peso, preço, categoria, estoque, descrição e imagem. Produtos sem quantidade exata ficam com estoque zero.</p>
                    <button type="submit" class="admin-primary-button" ${suppliers.length ? "" : "disabled"}>Validar e importar</button>
                </form>
            </div>
            <div class="admin-supplier-list-heading"><h4>Fornecedores cadastrados</h4><span>${suppliers.length}</span></div>
            <div class="admin-supplier-list">${supplierCards}</div>
        </section>`;
}

document.addEventListener("submit", async event => {
    const createForm = event.target.closest("#adminSupplierCreateForm");
    if (createForm) {
        event.preventDefault();
        const button = createForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            const values = Object.fromEntries(new FormData(createForm).entries());
            await api.createSupplier(values);
            await window.loadAdminSection?.("suppliers");
            showMessage("Fornecedor cadastrado com sucesso.");
        } catch (error) {
            showMessage(error.message || "Não foi possível cadastrar o fornecedor.", true);
            button.disabled = false;
        }
        return;
    }

    const importForm = event.target.closest("#adminSupplierImportForm");
    if (!importForm) return;
    event.preventDefault();
    const button = importForm.querySelector('[type="submit"]');
    const file = importForm.elements.catalogFile.files?.[0];
    if (!file) return showMessage("Escolha o CSV que deseja importar.", true);
    button.disabled = true;
    button.textContent = "Validando e importando…";
    try {
        const csv = await file.text();
        const result = await api.importSupplierCatalog(importForm.elements.supplierId.value, csv);
        const summary = result.data || {};
        importForm.reset();
        await window.loadAdminSection?.("suppliers");
        showMessage(`Importação concluída: ${summary.imported || 0} novo(s), ${summary.updated || 0} atualizado(s), ${summary.stockReview || 0} produto(s) precisam de quantidade no Estoque.`);
    } catch (error) {
        showMessage(error.message || "Não foi possível importar o catálogo.", true);
    } finally {
        button.disabled = false;
        button.textContent = "Validar e importar";
    }
});

document.addEventListener("click", async event => {
    const button = event.target.closest("[data-import-source-id][data-source-file]");
    if (!button) return;
    button.disabled = true;
    button.textContent = "Importando…";
    try {
        const response = await fetch(`/data/catalog/sources/${encodeURIComponent(button.dataset.sourceFile)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Não foi possível carregar o CSV publicado.");
        const result = await api.importSupplierCatalog(button.dataset.importSourceId, await response.text());
        const summary = result.data || {};
        await window.loadAdminSection?.("suppliers");
        showMessage(`Importação concluída: ${summary.imported || 0} novo(s), ${summary.updated || 0} atualizado(s), ${summary.stockReview || 0} produto(s) precisam de quantidade no Estoque.`);
    } catch (error) {
        showMessage(error.message || "Não foi possível importar o catálogo.", true);
        button.disabled = false;
        button.textContent = "Importar CSV cadastrado";
    }
});
