const BatchService = require('../services/BatchService');
const SimplexService = require('../services/SimplexService');
const TronService = require('../services/TronService');

/**
 * Batch Controller
 */
class BatchController {
  /**
   * List batches
   * GET /api/batches
   */
  async list(req, res) {
    try {
      const result = await BatchService.listBatches(req.query);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('List batches error:', error);
      res.status(500).json({ error: 'Failed to list batches' });
    }
  }

  /**
   * Create batch
   * POST /api/batches
   */
  async create(req, res) {
    try {
      const { donationIds, targetWallet, campaignId } = req.body;

      if (!donationIds || !Array.isArray(donationIds) || donationIds.length === 0) {
        return res.status(400).json({ error: 'Donation IDs array is required' });
      }

      if (!targetWallet) {
        return res.status(400).json({ error: 'Target wallet address is required' });
      }

      const batch = await BatchService.createBatch(
        donationIds,
        targetWallet,
        campaignId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        batch
      });
    } catch (error) {
      console.error('Create batch error:', error);
      res.status(500).json({ error: `Failed to create batch: ${error.message}` });
    }
  }

  /**
   * Get batch details
   * GET /api/batches/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;

      const batch = await BatchService.getBatchDetails(id);

      res.json({
        success: true,
        batch
      });
    } catch (error) {
      console.error('Get batch error:', error);
      res.status(500).json({ error: `Failed to get batch: ${error.message}` });
    }
  }

  /**
   * Get batch reserve details
   * GET /api/batches/:id/reserve
   */
  async getReserve(req, res) {
    try {
      const { id } = req.params;
      const reserve = await BatchService.getBatchReserve(id);

      res.json({
        success: true,
        reserve
      });
    } catch (error) {
      console.error('Get batch reserve error:', error);
      res.status(500).json({ error: `Failed to get batch reserve: ${error.message}` });
    }
  }

  /**
   * Get daily reserve summary
   * GET /api/batches/reserve-summary?date=YYYY-MM-DD
   */
  async getReserveSummary(req, res) {
    try {
      const { date } = req.query;
      const summary = await BatchService.getReserveSummary(date);

      res.json({
        success: true,
        summary
      });
    } catch (error) {
      console.error('Get reserve summary error:', error);
      res.status(500).json({ error: `Failed to get reserve summary: ${error.message}` });
    }
  }

  /**
   * Get landing checklist for batch
   * GET /api/batches/:id/landing-checklist
   */
  async getLandingChecklist(req, res) {
    try {
      const { id } = req.params;
      const checklist = await BatchService.getLandingChecklist(id);

      res.json({
        success: true,
        checklist
      });
    } catch (error) {
      console.error('Get landing checklist error:', error);
      res.status(500).json({ error: `Failed to get landing checklist: ${error.message}` });
    }
  }

  /**
   * Record gross deposit for payout
   * POST /api/batches/:id/gross-deposit
   */
  async setGrossDeposit(req, res) {
    try {
      const { id } = req.params;
      const { grossDepositEur, note } = req.body;

      const result = await BatchService.setGrossDeposit(id, grossDepositEur, note);

      res.json({
        success: true,
        grossDeposit: result
      });
    } catch (error) {
      console.error('Set gross deposit error:', error);
      res.status(500).json({ error: `Failed to set gross deposit: ${error.message}` });
    }
  }

  /**
   * Get operational fee status for batch
   * GET /api/batches/:id/operational-fee
   */
  async getOperationalFee(req, res) {
    try {
      const { id } = req.params;
      const status = await BatchService.getOperationalFeeStatus(id);

      res.json({
        success: true,
        operationalFee: status
      });
    } catch (error) {
      console.error('Get operational fee error:', error);
      res.status(500).json({ error: `Failed to get operational fee: ${error.message}` });
    }
  }

  /**
   * Record operational fee payment
   * POST /api/batches/:id/operational-fee
   */
  async payOperationalFee(req, res) {
    try {
      const { id } = req.params;
      const { amountEur, note } = req.body;

      const result = await BatchService.recordOperationalFeePayment(id, amountEur, note);

      res.json({
        success: true,
        operationalFee: result
      });
    } catch (error) {
      console.error('Pay operational fee error:', error);
      res.status(500).json({ error: `Failed to record operational fee: ${error.message}` });
    }
  }

  /**
   * Process batch
   * POST /api/batches/:id/process
   */
  async process(req, res) {
    try {
      const { id } = req.params;

      const batch = await BatchService.processBatch(id);

      res.json({
        success: true,
        batch
      });
    } catch (error) {
      console.error('Process batch error:', error);
      res.status(500).json({ error: `Failed to process batch: ${error.message}` });
    }
  }

  /**
   * Initiate Simplex purchase
   * POST /api/batches/:id/initiate-simplex
   */
  async initiateSimplex(req, res) {
    try {
      const { id } = req.params;
      const userData = req.body.userData || {
        userId: req.user.userId,
        email: req.user.email,
        firstName: req.user.username,
        lastName: 'User'
      };

      const batch = await BatchService.getBatchDetails(id);
      const metadata = batch.metadata || {};
      if (!metadata.grossDepositEur) {
        return res.status(400).json({
          error: 'Gross deposit must be set before initiating Simplex'
        });
      }
      const reserve = BatchService.getSimplexReserve(batch.totalNetEur);
      if (reserve.reserveRequiredEur > 0) {
        return res.status(400).json({
          error: 'Batch total below Simplex minimum purchase amount',
          minimumEur: reserve.minimumEur,
          reserveRequiredEur: reserve.reserveRequiredEur
        });
      }

      const result = await SimplexService.initiatePayment(id, userData);

      res.json({
        success: true,
        paymentUrl: result.paymentUrl,
        paymentId: result.paymentId,
        quoteId: result.quoteId
      });
    } catch (error) {
      console.error('Initiate Simplex error:', error);
      res.status(500).json({ error: `Failed to initiate Simplex payment: ${error.message}` });
    }
  }

  /**
   * Handle Simplex callback
   * POST /api/batches/:id/simplex-callback
   */
  async simplexCallback(req, res) {
    try {
      const { id } = req.params;

      const batch = await SimplexService.handleCallback(req.body);

      res.json({
        success: true,
        batch
      });
    } catch (error) {
      console.error('Simplex callback error:', error);
      res.status(500).json({ error: `Failed to process Simplex callback: ${error.message}` });
    }
  }

  /**
   * Send to TRON network
   * POST /api/batches/:id/send-tron
   */
  async sendTron(req, res) {
    try {
      const { id } = req.params;

      const result = await TronService.sendBatchToTron(id);

      res.json({
        success: true,
        batch: result.batch,
        transaction: result.transaction,
        transactionHash: result.transactionHash
      });
    } catch (error) {
      console.error('Send TRON error:', error);
      res.status(500).json({ error: `Failed to send to TRON: ${error.message}` });
    }
  }

  /**
   * Get batch status
   * GET /api/batches/:id/status
   */
  async getStatus(req, res) {
    try {
      const { id } = req.params;

      const batch = await BatchService.getBatchDetails(id);

      res.json({
        success: true,
        status: batch.status,
        batch
      });
    } catch (error) {
      console.error('Get batch status error:', error);
      res.status(500).json({ error: `Failed to get batch status: ${error.message}` });
    }
  }

  /**
   * Cancel batch
   * DELETE /api/batches/:id
   */
  async cancel(req, res) {
    try {
      const { id } = req.params;

      await BatchService.updateBatchStatus(id, 'cancelled');

      res.json({
        success: true,
        message: 'Batch cancelled successfully'
      });
    } catch (error) {
      console.error('Cancel batch error:', error);
      res.status(500).json({ error: `Failed to cancel batch: ${error.message}` });
    }
  }
}

module.exports = new BatchController();
