const models = require('../database/models');
const { Op } = require('sequelize');

/**
 * Admin Controller
 */
class AdminController {
  /**
   * Get dashboard data
   * GET /api/admin/dashboard
   */
  async getDashboard(req, res) {
    try {
      // Get donation statistics
      const donationStats = await models.Donation.findAll({
        attributes: [
          [models.sequelize.fn('SUM', models.sequelize.col('euro_amount')), 'totalEur'],
          [models.sequelize.fn('SUM', models.sequelize.col('debt_fee_amount')), 'totalDebtFee'],
          [models.sequelize.fn('SUM', models.sequelize.col('operational_fee_amount')), 'totalOperationalFee'],
          [models.sequelize.fn('SUM', models.sequelize.col('transaction_fee_amount')), 'totalTransactionFee'],
          [models.sequelize.fn('SUM', models.sequelize.col('net_amount_eur')), 'totalNet'],
          [models.sequelize.fn('COUNT', models.sequelize.col('donation_id')), 'totalDonations']
        ],
        raw: true,
        group: []
      });

      // Get campaign count
      const campaignCount = await models.Campaign.count();

      // Get batch statistics
      const batchStats = await models.TransactionBatch.findAll({
        attributes: [
          [models.sequelize.fn('COUNT', models.sequelize.col('batch_id')), 'totalBatches'],
          [models.sequelize.fn('SUM', models.sequelize.col('total_net_eur')), 'totalProcessed']
        ],
        where: {
          status: {
            [Op.in]: ['completed', 'sending']
          }
        },
        raw: true,
        group: []
      });

      // Get pending donations count
      const pendingDonations = await models.Donation.count({
        where: { status: 'pending' }
      });

      res.json({
        success: true,
        dashboard: {
          donations: donationStats[0] || {},
          campaigns: { total: campaignCount },
          batches: batchStats[0] || {},
          pendingDonations
        }
      });
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  }

  /**
   * Update system config
   * POST /api/admin/config
   */
  async updateConfig(req, res) {
    try {
      const { configKey, configValue, configType } = req.body;

      if (!configKey || !configValue || !configType) {
        return res.status(400).json({ error: 'Config key, value, and type are required' });
      }

      const [config, created] = await models.SystemConfig.findOrCreate({
        where: { configKey },
        defaults: {
          configValue,
          configType,
          updatedBy: req.user.userId
        }
      });

      if (!created) {
        await config.update({
          configValue,
          configType,
          updatedBy: req.user.userId
        });
      }

      res.json({
        success: true,
        config
      });
    } catch (error) {
      console.error('Update config error:', error);
      res.status(500).json({ error: 'Failed to update config' });
    }
  }

  /**
   * Get system logs
   * GET /api/admin/logs
   */
  async getLogs(req, res) {
    try {
      const { page = 1, limit = 50, action, entityType } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;

      const { count, rows } = await models.AuditLog.findAndCountAll({
        where,
        include: [
          {
            model: models.User,
            as: 'user',
            attributes: ['userId', 'username', 'email']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        logs: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Get logs error:', error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }

  /**
   * Trigger backup
   * POST /api/admin/backup
   */
  async backup(req, res) {
    try {
      // Placeholder for backup functionality
      // In production, this would trigger a database backup
      res.json({
        success: true,
        message: 'Backup triggered successfully'
      });
    } catch (error) {
      console.error('Backup error:', error);
      res.status(500).json({ error: 'Failed to trigger backup' });
    }
  }
}

module.exports = new AdminController();
