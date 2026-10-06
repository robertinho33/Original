"use strict";

const service = require("../services/marketing-service");

function actor(req) {
    return req.admin?.email || req.admin?.uid || req.admin?.role || "Administrador";
}

function sendError(res, error, fallback) {
    console.error("[ADMIN MARKETING]", error);
    res.status(Number(error?.status) || 500).json({ success: false, error: error?.message || fallback });
}

async function hero(req, res) {
    try { res.json({ success: true, data: await service.getHeroDraft() }); }
    catch (error) { sendError(res, error, "Não foi possível carregar o banner."); }
}

async function saveHero(req, res) {
    try { res.json({ success: true, data: await service.saveHeroDraft(req.body || {}, actor(req)) }); }
    catch (error) { sendError(res, error, "Não foi possível salvar o rascunho do banner."); }
}

async function activateHero(req, res) {
    if (req.admin?.role !== "admin") return res.status(403).json({ success: false, error: "Somente o administrador pode publicar o banner." });
    try { res.json({ success: true, data: await service.activateHero(actor(req)) }); }
    catch (error) { sendError(res, error, "Não foi possível publicar o banner."); }
}

async function publicHero(req, res) {
    try {
        const data = await service.getActiveHero();
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        res.json({ success: true, data });
    } catch (error) {
        console.error("[STOREFRONT HERO]", error);
        res.status(500).json({ success: false, data: null });
    }
}

async function campaigns(req, res) {
    try { res.json({ success: true, data: await service.listCampaigns() }); }
    catch (error) { sendError(res, error, "Não foi possível carregar as campanhas."); }
}

async function previewAudience(req, res) {
    try { res.json({ success: true, data: await service.previewAudience(req.body?.targetType, req.body?.filters || {}) }); }
    catch (error) { sendError(res, error, "Não foi possível calcular o público."); }
}

async function createCampaign(req, res) {
    try {
        const data = await service.createCampaign(req.body || {}, actor(req), req.admin?.role === "admin");
        res.status(201).json({ success: true, data });
    } catch (error) { sendError(res, error, "Não foi possível salvar a campanha."); }
}

async function launchCampaign(req, res) {
    if (req.admin?.role !== "admin") return res.status(403).json({ success: false, error: "Somente o administrador pode ativar uma campanha." });
    try { res.json({ success: true, data: await service.launchCampaign(req.params.id, actor(req)) }); }
    catch (error) { sendError(res, error, "Não foi possível ativar a campanha."); }
}

module.exports = { hero, saveHero, activateHero, publicHero, campaigns, previewAudience, createCampaign, launchCampaign };
