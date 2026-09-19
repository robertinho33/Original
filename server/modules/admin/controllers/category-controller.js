const service = require("../services/catalog-write-service");

async function createCategory(req, res) {
    try {
        const data = await service.createCategory(req.body);
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error("[ADMIN CATEGORY CREATE]", error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

async function updateCategory(req, res) {
    try {
        const data = await service.updateCategory(
            req.params.id,
            req.body
        );

        res.json({ success: true, data });
    } catch (error) {
        console.error("[ADMIN CATEGORY UPDATE]", error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    createCategory,
    updateCategory
};
