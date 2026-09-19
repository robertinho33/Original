function getSession(admin) {
    return {
        authenticated: Boolean(admin?.authenticated),
        role: admin?.role || "super_admin",
        timestamp: new Date().toISOString()
    };
}

module.exports = { getSession };
