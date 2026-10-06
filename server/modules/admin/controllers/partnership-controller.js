"use strict";
const service = require("../services/partnership-service");
async function overview(req, res) {
    try { res.json({ success: true, data: await service.getOverview() }); }
    catch (error) {
        console.error("[ADMIN PARTNERSHIPS]", error);
        res.status(500).json({ success: false, error: "Não foi possível carregar os relacionamentos agora." });
    }
}
module.exports = { overview };
