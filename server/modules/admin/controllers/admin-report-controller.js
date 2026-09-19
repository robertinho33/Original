const reportService = require("../services/admin-report-service");

async function sales(req, res) {
    try {
        const data = await reportService.getSalesReport();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function products(req, res) {
    try {
        const data = await reportService.getProductReport();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function customers(req, res) {
    try {
        const data = await reportService.getCustomerReport();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    sales,
    products,
    customers
};
