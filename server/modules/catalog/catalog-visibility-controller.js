"use strict";

const service = require("./catalog-visibility-service");

async function storefront(req, res, next) {
    try {
        const state = await service.getVisibility();
        res.set("Cache-Control", "no-store");
        return res.json({
            success: true,
            data: {
                visibleSources: state.sources
                    .filter(source => source.visible)
                    .map(source => source.id),
                inactiveProductSkus: state.inactiveProductSkus
            }
        });
    } catch (error) {
        return next(error);
    }
}

async function adminRead(req, res, next) {
    try {
        return res.json({ success: true, data: await service.getVisibility() });
    } catch (error) {
        return next(error);
    }
}

async function updateSource(req, res, next) {
    try {
        const data = await service.setSourceVisibility(
            req.params.id,
            req.body?.visible,
            req.admin?.email
        );
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
}

async function updateProduct(req, res, next) {
    try {
        const data = await service.setProductVisibility(
            req.params.id,
            req.body?.visible,
            req.admin?.email
        );
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
}

module.exports = { storefront, adminRead, updateSource, updateProduct };
