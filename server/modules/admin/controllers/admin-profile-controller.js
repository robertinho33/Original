const service = require("../services/admin-service");

async function getProfile(req, res) {
    try {
        const data = await service.getAdminProfile(req.admin || null);
        res.json({ success: true, data });
    } catch (error) {
        console.error("[ADMIN PROFILE]", error);
        res.status(500).json({
            success: false,
            error: "Não foi possível carregar o perfil administrativo."
        });
    }
}

module.exports = { getProfile };
