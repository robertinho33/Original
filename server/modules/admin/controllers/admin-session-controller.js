const service = require("../services/admin-session-service");

async function getSession(req, res) {
    res.json({
        success: true,
        data: service.getSession(req.admin)
    });
}

module.exports = { getSession };
