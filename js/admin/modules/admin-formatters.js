export function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

export function number(value) {
    return Number(value || 0).toLocaleString("pt-BR");
}

export function date(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function metric(title, value, description = "") {
    return `
        <article class="admin-metric-card">
            <span>${escapeHtml(title)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${description
                ? `<small>${escapeHtml(description)}</small>`
                : ""}
        </article>
    `;
}
