const service =
    require("../services/reservation-service");

async function getReservations(req, res) {
    try {
        const data = await service.getReservations();

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
    getReservations
};
