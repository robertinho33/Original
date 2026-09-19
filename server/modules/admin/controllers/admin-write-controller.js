const service = require("../services/admin-write-service");

function success(res, data) {
    return res.json({
        success: true,
        data
    });
}

function failure(res, error) {
    console.error("[ADMIN]", error);

    return res.status(400).json({
        success: false,
        error: error.message
    });
}

async function updateProduct(req, res) {
    try {
        return success(
            res,
            await service.updateProduct(
                req.params.id,
                req.body
            )
        );
    } catch (error) {
        return failure(res, error);
    }
}

async function updateOrderStatus(req, res) {
    try {
        return success(
            res,
            await service.updateOrderStatus(
                req.params.id,
                req.body.status
            )
        );
    } catch (error) {
        return failure(res, error);
    }
}

async function createInventoryMovement(req, res) {
    try {
        return success(
            res,
            await service.createInventoryMovement(req.body)
        );
    } catch (error) {
        return failure(res, error);
    }
}

async function updateShipment(req, res) {
    try {
        return success(
            res,
            await service.updateShipment(
                req.params.id,
                req.body
            )
        );
    } catch (error) {
        return failure(res, error);
    }
}

async function updateSettings(req, res) {
    try {
        return success(
            res,
            await service.updateSettings(req.body)
        );
    } catch (error) {
        return failure(res, error);
    }
}

module.exports = {
    updateProduct,
    updateOrderStatus,
    createInventoryMovement,
    updateShipment,
    updateSettings
};
