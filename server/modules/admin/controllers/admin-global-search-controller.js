const service =
    require("../services/admin-global-search-service");

async function search(req, res) {

    try {

        const data =
            await service.search(
                req.query.q
            );

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
    search
};
