const permissionService = require("./admin-permission-service");

async function getAdminProfile(admin) {
    const role = admin?.role || "super_admin";

    return {
        authenticated: Boolean(admin?.authenticated),
        role,
        permissions: permissionService.getPermissions(role)
    };
}

module.exports = {
    getAdminProfile
};
