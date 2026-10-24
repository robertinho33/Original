const {isQuotaError,quotaMessage}=require('../../../infrastructure/admin-read-cache');
const service = require("../services/admin-overview-service");

async function overview(req, res) {
    try {
        res.json({
            success: true,
            data: await service.getOverview()
        });
    } catch (error) {
        console.error("[ADMIN OVERVIEW]", error);
        res.status(isQuotaError(error)?503:500).json({
            success: false,
            code: isQuotaError(error)?"DATABASE_QUOTA_EXCEEDED":"ADMIN_READ_FAILED",
            error: isQuotaError(error)?quotaMessage:"Não foi possível carregar o resumo administrativo."
        });
    }
}

async function timeline(req, res) {
    try {
        const days = Math.min(
            Math.max(Number(req.query.days || 30), 1),
            365
        );

        res.json({
            success: true,
            data: await service.getTimeline(days)
        });
    } catch (error) {
        console.error("[ADMIN TIMELINE]", error);
        res.status(isQuotaError(error)?503:500).json({
            success: false,
            code: isQuotaError(error)?"DATABASE_QUOTA_EXCEEDED":"ADMIN_READ_FAILED",
            error: isQuotaError(error)?quotaMessage:"Não foi possível carregar a evolução das vendas."
        });
    }
}

async function alerts(req, res) {
    try {
        res.json({
            success: true,
            data: await service.getAlerts()
        });
    } catch (error) {
        console.error("[ADMIN ALERTS]", error);
        res.status(isQuotaError(error)?503:500).json({
            success: false,
            code: isQuotaError(error)?"DATABASE_QUOTA_EXCEEDED":"ADMIN_READ_FAILED",
            error: isQuotaError(error)?quotaMessage:"Não foi possível carregar os alertas."
        });
    }
}

module.exports = {
    overview,
    timeline,
    alerts
};
