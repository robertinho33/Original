const service =
    require("../services/inventory-history-service");

async function getHistory(req, res) {
    try {
        const data = await service.getHistory(req.query.limit);

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
    getHistory
};
