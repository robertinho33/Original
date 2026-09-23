"use strict";

const {
    getAuth
} = require("../../infrastructure/firebase/firebase-admin");

const MASTER_EMAIL =
    "robertinho33@gmail.com";

module.exports = async function adminAuth(req, res, next) {

    const authorization =
        String(
            req.headers.authorization || ""
        ).trim();

    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );

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
        const decodedToken =
            await getAuth().verifyIdToken(idToken);

        const email =
            String(
                decodedToken.email || ""
            ).trim().toLowerCase();

        if (!email) {
            return res.status(403).json({
                success: false,
                error: "Conta Firebase sem e-mail autorizado."
            });
        }

        if (email !== MASTER_EMAIL) {
            return res.status(403).json({
                success: false,
                error: "Usuário sem autorização administrativa."
            });
        }

        req.admin = {
            authenticated: true,
            uid: decodedToken.uid,
            email,
            role: "admin"
        };

        return next();

    } catch (error) {

        console.error(
            "[ADMIN AUTH] Falha ao validar Firebase ID token:",
            error?.code || error?.message || error
        );

        return res.status(401).json({
            success: false,
            error: "Token Firebase inválido ou expirado."
        });
    }
};
