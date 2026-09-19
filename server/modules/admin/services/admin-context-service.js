function getAdminContext(req) {
    return {
        authenticated: Boolean(req.admin?.authenticated),
        role: req.admin?.role || "super_admin",
        timestamp: new Date().toISOString()
    };
}

module.exports = { getAdminContext };
