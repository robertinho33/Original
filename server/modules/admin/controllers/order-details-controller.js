const service =
    require("../services/order-details-service");

async function getOrderDetails(req, res) {
    try {
        const data =
            await service.getOrderDetails(req.params.id);

        if (!data) {
            return res.status(404).json({
                success: false,
                error: "Pedido não encontrado."
            });
        }

        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    getOrderDetails
};
