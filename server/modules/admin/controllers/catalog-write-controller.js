const service =
    require("../services/catalog-write-service");

function success(res, data) {

    return res.json({
        success: true,
        data
    });
}

function failure(res, error) {

    console.error(
        "[ADMIN]",
        error
    );

    return res.status(400).json({
        success: false,
        error: error.message
    });
}

async function createCategory(req, res) {

    try {

        return success(
            res,
            await service.createCategory(
                req.body
            )
        );

    } catch (error) {

        return failure(
            res,
            error
        );
    }
}

async function updateCategory(req, res) {

    try {

        return success(
            res,
            await service.updateCategory(
                req.params.id,
                req.body
            )
        );

    } catch (error) {

        return failure(
            res,
            error
        );
    }
}

async function createCoupon(req, res) {

    try {

        return success(
            res,
            await service.createCoupon(
                req.body
            )
        );

    } catch (error) {

        return failure(
            res,
            error
        );
    }
}

async function updateCoupon(req, res) {

    try {

        return success(
            res,
            await service.updateCoupon(
                req.params.id,
                req.body
            )
        );

    } catch (error) {

        return failure(
            res,
            error
        );
    }
}

module.exports = {
    createCategory,
    updateCategory,
    createCoupon,
    updateCoupon
};
