const service = require("../services/admin-customer-service");

async function details(req, res) {
    try {
        const data = await service.getCustomerDetails(req.params.id);

        if (!data) {
            return res.status(404).json({
                success: false,
                error: "Cliente não encontrado."
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

module.exports = {
    details
};
