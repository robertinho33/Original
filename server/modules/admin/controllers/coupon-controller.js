const service = require("../services/catalog-write-service");

async function createCoupon(req, res) {
    try {
        const data = await service.createCoupon(req.body);
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error("[ADMIN COUPON CREATE]", error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

async function updateCoupon(req, res) {
    try {
        const data = await service.updateCoupon(
            req.params.id,
            req.body
        );

        res.json({ success: true, data });
    } catch (error) {
        console.error("[ADMIN COUPON UPDATE]", error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    createCoupon,
    updateCoupon
};
