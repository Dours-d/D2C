const models = require('../database/models');
const { Op } = require('sequelize');

/**
 * Campaign Controller
 */
class CampaignController {
  /**
   * List all campaigns
   * GET /api/campaigns
   */
  async list(req, res) {
    try {
      const { status, sourceType, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (status) where.status = status;
      if (sourceType) where.sourceType = sourceType;

      const { count, rows } = await models.Campaign.findAndCountAll({
        where,
        include: [
          {
            model: models.User,
            as: 'creator',
            attributes: ['userId', 'username', 'email']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        campaigns: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('List campaigns error:', error);
      res.status(500).json({ error: 'Failed to list campaigns' });
    }
  }

  /**
   * Get campaign by ID
   * GET /api/campaigns/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;

      const campaign = await models.Campaign.findByPk(id, {
        include: [
          {
            model: models.User,
            as: 'creator',
            attributes: ['userId', 'username', 'email']
          },
          {
            model: models.Donation,
            as: 'donations',
            limit: 10,
            order: [['createdAt', 'DESC']]
          }
        ]
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json({
        success: true,
        campaign
      });
    } catch (error) {
      console.error('Get campaign error:', error);
      res.status(500).json({ error: 'Failed to get campaign' });
    }
  }

  /**
   * Create campaign
   * POST /api/campaigns
   */
  async create(req, res) {
    try {
      const {
        campaignName,
        description,
        whatsappNumber,
        walletAddress,
        sourceType,
        status,
        metadata
      } = req.body;

      if (!campaignName || !whatsappNumber || !sourceType) {
        return res.status(400).json({ error: 'Campaign name, WhatsApp number, and source type are required' });
      }

      const campaign = await models.Campaign.create({
        campaignName,
        description,
        whatsappNumber,
        walletAddress,
        sourceType,
        status: status || 'draft',
        createdBy: req.user.userId,
        metadata: metadata || {}
      });

      res.status(201).json({
        success: true,
        campaign
      });
    } catch (error) {
      console.error('Create campaign error:', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }

  /**
   * Update campaign
   * PUT /api/campaigns/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const campaign = await models.Campaign.findByPk(id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      await campaign.update(updateData);

      res.json({
        success: true,
        campaign
      });
    } catch (error) {
      console.error('Update campaign error:', error);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  }

  /**
   * Delete campaign
   * DELETE /api/campaigns/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      const campaign = await models.Campaign.findByPk(id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      await campaign.destroy();

      res.json({
        success: true,
        message: 'Campaign deleted successfully'
      });
    } catch (error) {
      console.error('Delete campaign error:', error);
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  }

  /**
   * Get campaign donations
   * GET /api/campaigns/:id/donations
   */
  async getDonations(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const campaign = await models.Campaign.findByPk(id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const { count, rows } = await models.Donation.findAndCountAll({
        where: { campaignId: id },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        donations: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Get campaign donations error:', error);
      res.status(500).json({ error: 'Failed to get campaign donations' });
    }
  }
}

module.exports = new CampaignController();
