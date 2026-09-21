(() => {
    "use strict";

    const API = window.AdminAPI;

    if (!API) {
        console.error("[ADMIN] AdminAPI não carregada.");
        return;
    }

    async function loadCoupons() {
        const container =
            document.querySelector("#couponsList") ||
            document.querySelector("[data-module='coupons']");

        try {
            const data = await API.get("/coupons");

            const coupons = Array.isArray(data)
                ? data
                : Array.isArray(data.coupons)
                    ? data.coupons
                    : [];

            if (!container) {
                console.warn("[ADMIN] Container de cupons não encontrado.");
                return coupons;
            }

            container.innerHTML = coupons.length
                ? coupons.map(coupon => `
                    <div class="admin-coupon-item" data-id="${coupon.id ?? ""}">
                        <strong>${escapeHtml(
                            coupon.code ??
                            coupon.codigo ??
                            coupon.name ??
                            "Cupom"
                        )}</strong>

                        <span>${formatDiscount(
                            coupon.discount ??
                            coupon.desconto ??
                            coupon.value ??
                            0
                        )}</span>
                    </div>
                `).join("")
                : "<p>Nenhum cupom encontrado.</p>";

            return coupons;

        } catch (error) {
            console.error("[ADMIN] Erro ao carregar cupons:", error);

            if (container) {
                container.innerHTML =
                    "<p>Não foi possível carregar os cupons.</p>";
            }

            return [];
        }
    }

    function formatDiscount(value) {
        const number = Number(value) || 0;

        return Number.isInteger(number)
            ? `${number}%`
            : number.toLocaleString("pt-BR", {
                maximumFractionDigits: 2
            }) + "%";
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.AdminCoupons = {
        load: loadCoupons
    };

    document.addEventListener("DOMContentLoaded", loadCoupons);
})();
