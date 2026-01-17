const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const campaignRoutes = require('./campaigns');
const donationRoutes = require('./donations');
const whatsappRoutes = require('./whatsapp');
const whydonateRoutes = require('./whydonate');
const batchRoutes = require('./batches');
const exchangeRoutes = require('./exchange');
const feeRoutes = require('./fees');
const adminRoutes = require('./admin');
const cycleRoutes = require('./cycles');

router.use('/auth', authRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/donations', donationRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/whydonate', whydonateRoutes);
router.use('/batches', batchRoutes);
router.use('/currencies', exchangeRoutes);
router.use('/exchange-rates', exchangeRoutes);
router.use('/fees', feeRoutes);
router.use('/admin', adminRoutes);
router.use('/cycles', cycleRoutes);

module.exports = router;
