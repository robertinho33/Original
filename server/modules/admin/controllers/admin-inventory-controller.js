const service = require("../services/admin-inventory-service");

async function details(req, res) {
    try {
        const data = await service.getStockDetails(req.params.id);

        if (!data) {
            return res.status(404).json({
                success: false,
                error: "Produto não encontrado."
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

async function movement(req, res) {
    try {
        const data = await service.createMovement(req.body);

        return res.status(201).json({
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

async function reservations(req, res) {
    try {
        const data = await service.getReservations();

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
    movement,
    reservations
};
