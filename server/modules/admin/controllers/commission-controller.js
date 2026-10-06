"use strict";
const service = require("../services/commission-service");
function actor(req) { return req.admin?.email || req.admin?.uid || req.admin?.role || "admin"; }
async function list(req, res) {
    try { res.json({ success: true, data: await service.list() }); }
    catch (error) { console.error("[ADMIN COMMISSIONS LIST]", error); res.status(500).json({ success: false, error: "Não foi possível carregar as comissões." }); }
}
async function sync(req, res) {
    try { res.json({ success: true, data: await service.sync(actor(req)) }); }
    catch (error) { console.error("[ADMIN COMMISSIONS SYNC]", error); res.status(500).json({ success: false, error: error.message || "Não foi possível sincronizar as comissões." }); }
}
async function markPaid(req, res) {
    try { res.json({ success: true, data: await service.markPaid(req.params.id, req.body || {}, actor(req)) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
}
module.exports = { list, sync, markPaid };
