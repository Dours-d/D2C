const express = require('express');
const router = express.Router();
const WhyDonateController = require('../controllers/WhyDonateController');
const { authenticate, adminOrOperator } = require('../middleware/auth');

router.post('/import', authenticate, adminOrOperator, WhyDonateController.upload, WhyDonateController.controller.import.bind(WhyDonateController.controller));
router.post('/process', authenticate, adminOrOperator, WhyDonateController.controller.processPayouts.bind(WhyDonateController.controller));

module.exports = router;
