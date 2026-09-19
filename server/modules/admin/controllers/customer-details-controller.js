const service =
    require("../services/customer-details-service");

async function getCustomerDetails(req, res) {
    try {
        const data =
            await service.getCustomerDetails(req.params.id);

        if (!data) {
            return res.status(404).json({
                success: false,
                error: "Cliente não encontrado."
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
    getCustomerDetails
};
