const express = require('express');
const router = express.Router();
const CampaignController = require('../controllers/CampaignController');
const { authenticate, adminOrOperator } = require('../middleware/auth');

router.get('/', authenticate, CampaignController.list.bind(CampaignController));
router.get('/:id', authenticate, CampaignController.getById.bind(CampaignController));
router.post('/', authenticate, adminOrOperator, CampaignController.create.bind(CampaignController));
router.put('/:id', authenticate, adminOrOperator, CampaignController.update.bind(CampaignController));
router.delete('/:id', authenticate, adminOrOperator, CampaignController.delete.bind(CampaignController));
router.get('/:id/donations', authenticate, CampaignController.getDonations.bind(CampaignController));

module.exports = router;
