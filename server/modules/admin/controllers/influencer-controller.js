"use strict";

const influencerService =
    require("../services/influencer-service");

async function list(req, res) {
    try {
        res.json({
            success: true,
            data:
                await influencerService
                    .listInfluencers()
        });
    } catch (error) {
        console.error(
            "[ADMIN INFLUENCERS LIST]",
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function get(req, res) {
    try {
        res.json({
            success: true,
            data:
                await influencerService
                    .getInfluencer(
                        req.params.id
                    )
        });
    } catch (error) {
        console.error(
            "[ADMIN INFLUENCER GET]",
            error
        );

        res.status(404).json({
            success: false,
            error: error.message
        });
    }
}

async function create(req, res) {
    try {
        res.status(201).json({
            success: true,
            data:
                await influencerService
                    .createInfluencer(
                        req.body || {}
                    )
        });
    } catch (error) {
        console.error(
            "[ADMIN INFLUENCER CREATE]",
            error
        );

        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

async function update(req, res) {
    try {
        res.json({
            success: true,
            data:
                await influencerService
                    .updateInfluencer(
                        req.params.id,
                        req.body || {}
                    )
        });
    } catch (error) {
        console.error(
            "[ADMIN INFLUENCER UPDATE]",
            error
        );

        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

async function remove(req, res) {
    try {
        res.json({
            success: true,
            data:
                await influencerService
                    .deleteInfluencer(
                        req.params.id
                    )
        });
    } catch (error) {
        console.error(
            "[ADMIN INFLUENCER DELETE]",
            error
        );

        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    list,
    get,
    create,
    update,
    remove
};
