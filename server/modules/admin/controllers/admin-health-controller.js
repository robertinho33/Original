const { query } = require("../repositories/admin-db");

async function health(req, res) {
    try {
        await query("SELECT 1");

        res.json({
            success: true,
            data: {
                admin: true,
                database: true,
                authenticated: true,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            data: {
                admin: true,
                database: false,
                authenticated: true
            },
            error: error.message
        });
    }
}

module.exports = {
    health
};
