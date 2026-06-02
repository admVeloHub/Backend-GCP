// VERSION: v1.1.0 | DATE: 2026-06-01 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.1.0 - checkPermission('corporativo') em todas as rotas /api/corporativo/*
const express = require('express');
const { checkPermission } = require('../middleware/auth');
const corporativoLegalRoutes = require('./corporativoLegal');
const corporativoBannerRoutes = require('./corporativoBanner');
const corporativoAvisosRoutes = require('./corporativoAvisos');
const corporativoAgendaRoutes = require('./corporativoAgenda');

const router = express.Router();

router.use(checkPermission('corporativo'));
router.use('/legal', corporativoLegalRoutes);
router.use('/avisos', corporativoAvisosRoutes);
router.use('/agenda', corporativoAgendaRoutes);
router.use('/', corporativoBannerRoutes);

module.exports = router;
