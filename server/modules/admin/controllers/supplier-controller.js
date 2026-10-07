"use strict";

const service = require("../../catalog/supplier-service");

async function list(req, res, next) {
    try { return res.json({ success: true, data: await service.listSuppliers() }); }
    catch (error) { return next(error); }
}

async function create(req, res, next) {
    try {
        const supplier = await service.createSupplier(req.body || {}, req.admin?.email);
        return res.status(201).json({ success: true, data: supplier });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
}

async function importCatalog(req, res, next) {
    try {
        const result = await service.importSupplierCatalog(req.params.id, req.body?.csv, req.admin?.email);
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
}

module.exports = { list, create, importCatalog };
