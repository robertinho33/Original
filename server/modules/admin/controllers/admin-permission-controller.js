const service = require("../services/admin-permission-service");

async function getPermissions(req, res) {
    try {
        const role = req.admin?.role || "super_admin";

        res.json({
            success: true,
            data: service.getPermissions(role)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    getPermissions
};
