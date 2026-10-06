"use strict";

const { getAuth } = require("../../infrastructure/firebase/firebase-admin");

const MASTER_EMAIL = "robertinho33@gmail.com";

module.exports = async function adminAuth(req, res, next) {
    const authorization = String(
        req.headers.authorization || ""
    ).trim();

    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        return res.status(401).json({
            success: false,
            error: "Token Firebase ausente."
        });
    }

    const idToken = match[1].trim();

    if (!idToken) {
        return res.status(401).json({
            success: false,
            error: "Token Firebase vazio."
        });
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);

        const email = String(
            decodedToken.email || ""
        ).trim().toLowerCase();

        if (!email) {
            return res.status(403).json({
                success: false,
                error: "Conta Firebase sem e-mail autorizado."
            });
        }

        const claimRole = String(decodedToken.role || "").trim().toLowerCase();
        const isMaster = email === MASTER_EMAIL.toLowerCase();
        const isAdminClaim = decodedToken.admin === true || claimRole === "admin";
        const isCollaborator = claimRole === "collaborator";

        if (!isMaster && !isAdminClaim && !isCollaborator) {
            return res.status(403).json({
                success: false,
                error: "Usuário sem autorização administrativa."
            });
        }

        const role = isMaster || isAdminClaim ? "admin" : "collaborator";
        req.admin = {
            authenticated: true,
            uid: decodedToken.uid,
            email,
            role
        };

        return next();

    } catch (error) {
        console.error(
            "[ADMIN AUTH] Falha ao validar Firebase ID token:",
            {
                code: error?.code || null,
                message: error?.message || null
            }
        );

        return res.status(401).json({
            success: false,
            error: "Token Firebase inválido ou expirado.",
            code: error?.code || "auth/unknown"
        });
    }
};
