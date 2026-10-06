"use strict";
const service = require("../services/influencer-contract-service");
function actor(req) { return req.admin?.email || req.admin?.uid || req.admin?.role || "admin"; }
async function list(req,res) { try { res.json({ success:true, data:await service.list() }); } catch(error) { console.error("[ADMIN CONTRACT LIST]",error); res.status(500).json({success:false,error:"Não foi possível carregar os contratos."}); } }
async function create(req,res) { try { res.status(201).json({success:true,data:await service.create(req.body || {},actor(req))}); } catch(error) { res.status(400).json({success:false,error:error.message}); } }
async function activate(req,res) { try { res.json({success:true,data:await service.activate(req.params.id,req.body || {},actor(req))}); } catch(error) { res.status(400).json({success:false,error:error.message}); } }
async function end(req,res) { try { res.json({success:true,data:await service.end(req.params.id,actor(req))}); } catch(error) { res.status(400).json({success:false,error:error.message}); } }
module.exports = { list, create, activate, end };


