const bunqCryptoService = require('../services/bunq-crypto-first.service');
const models = require('../../../src/database/models');
const logger = require('../utils/logger');
const { batchQueue } = require('../../../src/queue');

class CycleController {
  /**
   * Get current processing cycle configuration
   */
  async getCurrentCycle(req, res) {
    try {
      const cycle = bunqCryptoService.getCurrentCycle();
      const nextProcessing = bunqCryptoService.calculateNextProcessingDate(cycle);
      
      const stats = await this.getCycleStatistics(cycle);
      
      res.json({
        currentCycle: cycle,
        nextProcessing,
        configuration: bunqCryptoService.priority.batchCycles,
        statistics: stats,
        canChange: true
      });
    } catch (error) {
      logger.error('Get current cycle error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update processing cycle
   */
  async updateCycle(req, res) {
    try {
      const { cycle, triggerOnChain, triggerBanking, minimumAmount, notes } = req.body;
      
      const result = await bunqCryptoService.updateProcessingCycle(cycle, {
        userId: req.user?.userId || null,
        triggerOnChain: triggerOnChain || false,
        triggerBanking: triggerBanking !== false,
        minimumAmount: minimumAmount || undefined,
        autoProcess: true
      });
      
      // Log the change
      if (models.AuditLog) {
        await models.AuditLog.create({
          userId: req.user?.userId || null,
          action: 'UPDATE_PROCESSING_CYCLE',
          entityType: 'system_config',
          entityId: 'processing_cycle',
          oldValues: { previousCycle: result.previousCycle },
          newValues: { newCycle: cycle, options: { triggerOnChain, triggerBanking } },
          ipAddress: req.ip
        });
      }
      
      res.json({
        success: true,
        message: `Processing cycle updated to ${cycle}`,
        ...result
      });
    } catch (error) {
      logger.error('Update cycle error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Trigger processing for a specific cycle
   */
  async triggerProcessing(req, res) {
    try {
      const { cycle, force } = req.body;
      
      if (force) {
        // Force immediate processing regardless of schedule
        const result = await bunqCryptoService.processWeeklyBatch({
          cycle: cycle || 'manual',
          immediate: true
        });
        
        res.json({
          success: true,
          triggered: 'immediate',
          result
        });
      } else {
        // Schedule for next appropriate time
        const scheduled = await this.scheduleProcessing(cycle);
        
        res.json({
          success: true,
          triggered: 'scheduled',
          scheduledTime: scheduled.time,
          cycle: scheduled.cycle
        });
      }
    } catch (error) {
      logger.error('Trigger processing error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get cycle-based statistics
   */
  async getCycleStatistics(cycle) {
    const { Op } = models.Sequelize;
    const now = new Date();
    let startDate;
    
    switch (cycle) {
      case 'daily':
        startDate = new Date(now.setDate(now.getDate() - 7)); // Last 7 days
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 28)); // Last 4 weeks
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 3)); // Last 3 months
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 30)); // Last 30 days
    }
    
    const stats = await models.Donation.findAll({
      where: {
        status: 'pending',
        createdAt: {
          [Op.gte]: startDate
        }
      },
      attributes: [
        [models.sequelize.fn('COUNT', models.sequelize.col('donation_id')), 'donation_count'],
        [models.sequelize.fn('SUM', models.sequelize.col('net_amount_eur')), 'total_amount'],
        [models.sequelize.fn('AVG', models.sequelize.col('net_amount_eur')), 'avg_amount'],
        [models.sequelize.fn('MIN', models.sequelize.col('created_at')), 'earliest'],
        [models.sequelize.fn('MAX', models.sequelize.col('created_at')), 'latest'],
        [models.sequelize.fn('COUNT', models.sequelize.fn('DISTINCT', models.sequelize.col('campaign_id'))), 'campaign_count']
      ],
      raw: true
    });
    
    const statData = stats[0] || {
      donation_count: 0,
      total_amount: 0,
      avg_amount: 0,
      earliest: null,
      latest: null,
      campaign_count: 0
    };
    
    // Calculate fee optimization potential
    const optimization = await this.calculateOptimizationPotential(statData);
    
    return {
      ...statData,
      optimization,
      recommendedCycle: this.recommendCycle(statData)
    };
  }

  /**
   * Calculate fee optimization potential
   */
  async calculateOptimizationPotential(stats) {
    const donationCount = parseInt(stats.donation_count || 0);
    const totalAmount = parseFloat(stats.total_amount || 0);
    const avgAmount = parseFloat(stats.avg_amount || 0);
    
    // Current weekly batch cost (estimate)
    const weeklyCost = this.estimateProcessingCost(totalAmount / 4, 'weekly'); // Assume 4 weeks
    
    // Alternative cycles cost
    const dailyCost = this.estimateProcessingCost(avgAmount * donationCount / 30, 'daily');
    const monthlyCost = this.estimateProcessingCost(totalAmount, 'monthly');
    
    // Find optimal
    const costs = [
      { cycle: 'daily', cost: dailyCost },
      { cycle: 'weekly', cost: weeklyCost },
      { cycle: 'monthly', cost: monthlyCost }
    ];
    
    const optimal = costs.reduce((min, curr) => 
      curr.cost.total < min.cost.total ? curr : min
    );
    
    return {
      currentCycle: 'weekly',
      currentCost: weeklyCost,
      optimalCycle: optimal.cycle,
      optimalCost: optimal.cost,
      potentialSavings: weeklyCost.total - optimal.cost.total,
      savingsPercent: weeklyCost.total > 0 
        ? ((weeklyCost.total - optimal.cost.total) / weeklyCost.total * 100).toFixed(1)
        : '0.0'
    };
  }

  // Helper methods
  estimateProcessingCost(amount, cycle) {
    const bunqFee = 0; // Free SEPA
    const cryptoFee = Math.max(10, amount * 0.035); // Simplex: 3.5% or €10 min
    
    // Frequency factor (more frequent = more fixed costs)
    const frequencyFactor = {
      daily: 22, // business days per month
      weekly: 4, // weeks per month
      monthly: 1
    };
    
    const fixedCosts = 0.25 * frequencyFactor[cycle]; // Assuming €0.25 per bank transfer
    
    return {
      bankFees: bunqFee * frequencyFactor[cycle],
      cryptoFees: cryptoFee * frequencyFactor[cycle],
      fixedCosts,
      total: (bunqFee + cryptoFee + 0.25) * frequencyFactor[cycle]
    };
  }

  recommendCycle(stats) {
    const donationCount = parseInt(stats.donation_count || 0);
    const totalAmount = parseFloat(stats.total_amount || 0);
    const avgAmount = parseFloat(stats.avg_amount || 0);
    
    if (totalAmount > 5000 && donationCount > 50) {
      return { cycle: 'daily', reason: 'High volume, frequent processing reduces risk' };
    } else if (totalAmount > 1000 && avgAmount < 100) {
      return { cycle: 'weekly', reason: 'Moderate volume with small donations' };
    } else if (totalAmount < 1000 && avgAmount > 200) {
      return { cycle: 'monthly', reason: 'Low volume but large donations' };
    } else {
      return { cycle: 'weekly', reason: 'Default optimal for most cases' };
    }
  }

  async scheduleProcessing(cycle) {
    const nextTime = bunqCryptoService.calculateNextProcessingDate(cycle);
    
    // Schedule in job queue
    const delay = nextTime ? nextTime.getTime() - Date.now() : 0;
    
    const job = await batchQueue.add('process-batch-cycle', {
      cycle: cycle || bunqCryptoService.getCurrentCycle(),
      scheduledTime: nextTime,
      triggeredBy: 'api'
    }, {
      delay: delay > 0 ? delay : 0
    });
    
    return {
      jobId: job.id,
      time: nextTime,
      cycle: cycle || bunqCryptoService.getCurrentCycle()
    };
  }

  /**
   * Get cycle execution history
   */
  async getHistory(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      // TODO: Query cycle_executions table when model is created
      // For now, return placeholder
      const history = await models.sequelize.query(`
        SELECT * FROM cycle_executions
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
      `, {
        replacements: { limit: parseInt(limit), offset: parseInt(offset) },
        type: models.sequelize.QueryTypes.SELECT
      }).catch(() => []);
      
      res.json({
        success: true,
        history: history || [],
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      logger.error('Get cycle history error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get optimization suggestions
   */
  async getOptimization(req, res) {
    try {
      const currentCycle = bunqCryptoService.getCurrentCycle();
      const stats = await this.getCycleStatistics(currentCycle);
      const optimization = stats.optimization;
      
      res.json({
        success: true,
        currentEfficiency: optimization,
        suggestions: [
          {
            type: 'cycle_adjustment',
            priority: optimization.potentialSavings > 10 ? 'high' : 'medium',
            description: `Consider switching to ${optimization.optimalCycle} cycle`,
            potentialSavings: optimization.potentialSavings,
            savingsPercent: optimization.savingsPercent
          }
        ],
        recommendedChanges: optimization.potentialSavings > 10 ? [
          {
            action: 'update_cycle',
            newCycle: optimization.optimalCycle,
            reason: `Could save ${optimization.savingsPercent}% in fees`
          }
        ] : []
      });
    } catch (error) {
      logger.error('Get optimization error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new CycleController();
