const service = require("../services/admin-order-service");

async function details(req, res) {
    try {
        const data = await service.getOrderDetails(req.params.id);

        if (!data) {
            return res.status(404).json({
                success: false,
                error: "Pedido não encontrado."
            });
        }

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

async function updateStatus(req, res) {
    try {
        const data = await service.updateOrderStatus(
            req.params.id,
            req.body.status
        );

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    details,
    updateStatus
};
