const express = require('express');
const router = express.Router();
const DonationController = require('../controllers/DonationController');
const { authenticate, adminOrOperator } = require('../middleware/auth');

router.get('/', authenticate, DonationController.list.bind(DonationController));
router.get('/stats', authenticate, DonationController.getStats.bind(DonationController));
router.get('/pending', authenticate, DonationController.getPending.bind(DonationController));
router.get('/:id', authenticate, DonationController.getById.bind(DonationController));
router.post('/', authenticate, adminOrOperator, DonationController.create.bind(DonationController));
router.post('/batch-create', authenticate, adminOrOperator, DonationController.batchCreate.bind(DonationController));
router.put('/:id', authenticate, adminOrOperator, DonationController.update.bind(DonationController));

module.exports = router;
