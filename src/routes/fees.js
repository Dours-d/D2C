const express = require('express');
const router = express.Router();
const models = require('../database/models');
const { authenticate } = require('../middleware/auth');

router.get('/allocations', authenticate, async (req, res) => {
  try {
    const { batchId, donationId } = req.query;
    const where = {};
    if (batchId) where.batchId = batchId;
    if (donationId) where.donationId = donationId;

    const allocations = await models.FeeAllocation.findAll({
      where,
      include: [
        {
          model: models.TransactionBatch,
          as: 'batch',
          attributes: ['batchId', 'batchNumber']
        },
        {
          model: models.Donation,
          as: 'donation',
          attributes: ['donationId', 'euroAmount']
        }
      ]
    });

    res.json({ success: true, allocations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get fee allocations' });
  }
});

router.get('/summary', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    
    if (startDate || endDate) {
      where.allocatedAt = {};
      if (startDate) where.allocatedAt[models.Sequelize.Op.gte] = new Date(startDate);
      if (endDate) where.allocatedAt[models.Sequelize.Op.lte] = new Date(endDate);
    }

    const summary = await models.FeeAllocation.findAll({
      where,
      attributes: [
        'feeType',
        [models.sequelize.fn('SUM', models.sequelize.col('fee_amount_eur')), 'totalEur'],
        [models.sequelize.fn('COUNT', models.sequelize.col('allocation_id')), 'count']
      ],
      group: ['feeType'],
      raw: true
    });

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get fee summary' });
  }
});

router.get('/accounts', authenticate, async (req, res) => {
  try {
    const accounts = await models.OperationalAccount.findAll({
      where: { isActive: true }
    });

    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get fee accounts' });
  }
});

module.exports = router;
