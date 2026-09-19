module.exports = function adminAuth(req, res, next) {

    const configuredToken =
        process.env.AUREA_ADMIN_TOKEN;

    if (!configuredToken) {
        return res.status(503).json({
            success: false,
            error: "AUREA_ADMIN_TOKEN não configurado."
        });
    }

    const authorization =
        String(
            req.headers.authorization || ""
        );

    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );

    if (!match) {
        return res.status(401).json({
            success: false,
            error: "Autorização administrativa ausente."
        });
    }

    if (match[1] !== configuredToken) {
        return res.status(401).json({
            success: false,
            error: "Token administrativo inválido."
        });
    }

    req.admin = {
        authenticated: true
    };

    next();
};
