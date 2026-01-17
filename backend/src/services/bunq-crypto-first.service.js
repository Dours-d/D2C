const logger = require('../utils/logger');
const models = require('../../../src/database/models');
const TronWeb = require('tronweb');

// Note: bunq-client package needs to be installed
// For now, we'll create a placeholder that can be implemented with actual Bunq API
class BunqCryptoFirstService {
  constructor() {
    // Bunq API configuration
    // TODO: Install bunq-client package and configure
    // this.bunq = new (require('bunq-client'))({
    //   apiKey: process.env.BUNQ_API_KEY,
    //   environment: process.env.BUNQ_ENVIRONMENT || 'SANDBOX',
    //   encryptionKey: process.env.BUNQ_ENCRYPTION_KEY
    // });
    
    // Crypto-first configuration
    this.priority = {
      primary: 'crypto_to_wallet', // Main necessity
      secondary: 'bank_transfers', // Only if crypto impossible
      batchCycles: {
        default: process.env.PROCESSING_CYCLE || 'weekly',
        configurable: true,
        minCycle: 'daily',
        maxCycle: 'monthly'
      }
    };
    
    // Fee minimization rules
    this.feeRules = {
      // Principle: Group transactions to minimize fees
      groupingThresholds: {
        minBatchSize: parseFloat(process.env.MINIMUM_BATCH_AMOUNT || '100'), // € - Minimum to process
        optimalBatchSize: 1000, // € - Most efficient
        maxWaitTime: parseInt(process.env.MAX_WAIT_DAYS || '7') // days - Maximum to accumulate
      },
      
      // Crypto purchase fee structure (percentages)
      cryptoFees: {
        simplex: { fixed: 10, percent: 3.5, minAmount: 50 },
        revolut: { fixed: 0, percent: 1.5, minAmount: 1 },
        binance: { fixed: 0, percent: 0.1, requiresKYC: true },
        kraken: { fixed: 0, percent: 0.26, minAmount: 10 }
      },
      
      // Bank transfer fees
      bankFees: {
        bunq_sepa: { fixed: 0.00, percent: 0 }, // Bunq: Free SEPA in EUR
        bunq_instant: { fixed: 0.25, percent: 0 },
        other_sepa: { fixed: 0.25, percent: 0 }
      }
    };
  }

  /**
   * MAIN PROCESSING FLOW: Crypto-first, fee-optimized
   */
  async processWeeklyBatch(config = {}) {
    const cycle = config.cycle || this.getCurrentCycle();
    logger.info(`Processing ${cycle} batch with crypto-first strategy`);
    
    // 1. Get all pending donations for the cycle
    const pendingDonations = await this.getPendingDonations(cycle);
    
    if (pendingDonations.length === 0) {
      return { status: 'no_pending', cycle };
    }
    
    // 2. Group by campaign wallet for crypto efficiency
    const groupedByWallet = this.groupByWallet(pendingDonations);
    
    // 3. For each wallet group, determine optimal strategy
    const processingResults = [];
    
    for (const [walletAddress, donations] of Object.entries(groupedByWallet)) {
      const totalAmount = donations.reduce((sum, d) => sum + parseFloat(d.netAmountEur || 0), 0);
      
      // CRITICAL: Check if we can send crypto directly
      const cryptoStrategy = await this.determineCryptoStrategy(
        walletAddress,
        totalAmount,
        donations.length
      );
      
      if (cryptoStrategy.viable) {
        // 4A. Execute crypto-first strategy
        const result = await this.executeCryptoFirst(
          cryptoStrategy,
          walletAddress,
          donations
        );
        processingResults.push(result);
      } else {
        // 4B. Fallback to bank transfer (secondary)
        logger.warn(`Crypto not viable for ${walletAddress}, falling back to bank`);
        const bankResult = await this.executeBankFallback(
          walletAddress,
          donations
        );
        processingResults.push(bankResult);
      }
    }
    
    // 5. Update cycle configuration if needed
    if (config.updateCycle) {
      await this.updateProcessingCycle(config.newCycle);
    }
    
    return {
      status: 'processed',
      cycle,
      timestamp: new Date(),
      results: processingResults,
      summary: this.generateSummary(processingResults)
    };
  }

  /**
   * Get pending donations for a cycle
   */
  async getPendingDonations(cycle) {
    const { Op } = models.Sequelize;
    const now = new Date();
    let startDate;
    
    // Calculate date range based on cycle
    switch (cycle) {
      case 'daily':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'biweekly':
        startDate = new Date(now.setDate(now.getDate() - 14));
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7)); // Default to weekly
    }
    
    return await models.Donation.findAll({
      where: {
        status: 'pending',
        createdAt: {
          [Op.gte]: startDate
        }
      },
      include: [{
        model: models.Campaign,
        as: 'campaign'
      }]
    });
  }

  /**
   * Group donations by wallet address
   */
  groupByWallet(donations) {
    const grouped = {};
    
    for (const donation of donations) {
      const walletAddress = donation.campaign?.walletAddress;
      if (!walletAddress) continue;
      
      if (!grouped[walletAddress]) {
        grouped[walletAddress] = [];
      }
      grouped[walletAddress].push(donation);
    }
    
    return grouped;
  }

  /**
   * Determine optimal crypto strategy
   */
  async determineCryptoStrategy(walletAddress, totalAmount, donationCount) {
    const strategies = [];
    
    // Strategy 1: Direct crypto purchase (preferred)
    strategies.push({
      name: 'direct_crypto_purchase',
      description: 'Buy crypto directly to destination wallet',
      provider: this.selectOptimalCryptoProvider(totalAmount),
      cost: this.calculateCryptoCost(totalAmount, 'direct'),
      viable: this.isCryptoViable(walletAddress, totalAmount),
      speed: '1-24 hours',
      requires: ['valid_wallet', 'minimum_amount']
    });
    
    // Strategy 2: Internal transfer + crypto (if we have crypto balances)
    const internalCrypto = await this.checkInternalCryptoBalances();
    if (internalCrypto.available >= totalAmount * 0.9) { // 90% coverage
      strategies.push({
        name: 'internal_crypto_transfer',
        description: 'Use existing crypto holdings',
        provider: 'internal',
        cost: this.calculateInternalTransferCost(totalAmount),
        viable: true,
        speed: 'instant',
        requires: ['sufficient_crypto_balance']
      });
    }
    
    // Strategy 3: P2P crypto purchase (lower fees, more complex)
    strategies.push({
      name: 'p2p_crypto_purchase',
      description: 'Peer-to-peer crypto purchase',
      provider: 'p2p_market',
      cost: this.calculateP2PCost(totalAmount),
      viable: totalAmount >= 100, // P2P better for larger amounts
      speed: '1-48 hours',
      requires: ['kyc_completed', 'trusted_counterparties']
    });
    
    // Select optimal strategy (lowest cost first)
    const viableStrategies = strategies.filter(s => s.viable);
    
    if (viableStrategies.length === 0) {
      return {
        viable: false,
        reason: 'No viable crypto strategy available',
        fallback: 'bank_transfer'
      };
    }
    
    // Choose by cost, then speed
    const optimal = viableStrategies.reduce((best, current) => {
      if (current.cost.total < best.cost.total) return current;
      if (current.cost.total === best.cost.total && current.speed === 'instant') return current;
      return best;
    });
    
    return {
      viable: true,
      strategy: optimal,
      executionPlan: this.createExecutionPlan(optimal, walletAddress, totalAmount)
    };
  }

  /**
   * Execute crypto-first strategy
   */
  async executeCryptoFirst(strategy, walletAddress, donations) {
    const { executionPlan } = strategy;
    const results = {
      strategy: strategy.strategy.name,
      wallet: walletAddress,
      donationsProcessed: donations.length,
      steps: [],
      status: 'initiated'
    };
    
    try {
      // Step 1: Group donations into optimal transaction sizes
      const transactionGroups = this.groupForOptimalFees(donations);
      
      for (const group of transactionGroups) {
        // Step 2: Execute according to provider
        let stepResult;
        
        switch (strategy.strategy.provider) {
          case 'simplex':
            stepResult = await this.executeSimplexPurchase(group, walletAddress);
            break;
          case 'revolut':
            stepResult = await this.executeRevolutCrypto(group, walletAddress);
            break;
          case 'internal':
            stepResult = await this.executeInternalCryptoTransfer(group, walletAddress);
            break;
          case 'p2p_market':
            stepResult = await this.executeP2PPurchase(group, walletAddress);
            break;
          default:
            throw new Error(`Unsupported provider: ${strategy.strategy.provider}`);
        }
        
        results.steps.push(stepResult);
      }
      
      // Step 3: Verify all transactions
      const verification = await this.verifyCryptoTransactions(results.steps);
      results.verification = verification;
      results.status = verification.allConfirmed ? 'completed' : 'partially_completed';
      
      // Step 4: Update donation statuses
      await this.markDonationsAsProcessed(donations, results);
      
      logger.info(`Crypto-first processing completed for ${walletAddress}`, results);
      
    } catch (error) {
      logger.error(`Crypto-first processing failed for ${walletAddress}:`, error);
      results.status = 'failed';
      results.error = error.message;
      
      // Trigger fallback
      await this.initiateFallback(walletAddress, donations, error);
    }
    
    return results;
  }

  /**
   * Bank transfer fallback (secondary)
   */
  async executeBankFallback(walletAddress, donations) {
    logger.info(`Initiating bank transfer fallback for ${walletAddress}`);
    
    // 1. Group for optimal bank transfer fees
    const bankGroups = this.groupForBankTransfers(donations);
    
    const results = {
      strategy: 'bank_transfer_fallback',
      wallet: walletAddress,
      donationsProcessed: donations.length,
      steps: [],
      status: 'initiated',
      note: 'Crypto was not viable, using bank transfer'
    };
    
    try {
      // 2. Use Bunq API for free SEPA transfers
      for (const group of bankGroups) {
        const transferResult = await this.executeBunqTransfer(group, walletAddress);
        results.steps.push(transferResult);
      }
      
      // 3. Mark as processed (awaiting manual crypto conversion)
      await this.markDonationsAsBankTransferred(donations, results);
      
      results.status = 'completed_awaiting_crypto';
      results.nextStep = 'manual_crypto_conversion_required';
      
    } catch (error) {
      logger.error(`Bank fallback failed for ${walletAddress}:`, error);
      results.status = 'failed';
      results.error = error.message;
      
      // Flag for manual intervention
      await this.flagForManualIntervention(walletAddress, donations, error);
    }
    
    return results;
  }

  /**
   * BUNQ API INTEGRATION (Free SEPA transfers)
   */
  async executeBunqTransfer(donationGroup, walletAddress) {
    const totalAmount = donationGroup.reduce((sum, d) => sum + parseFloat(d.netAmountEur || 0), 0);
    const reference = `DON-${donationGroup[0].donationId}-${Date.now()}`;
    
    try {
      // TODO: Implement actual Bunq API integration
      // For now, return a placeholder structure
      logger.warn('Bunq API integration not yet implemented. Using placeholder.');
      
      // Bunq API: Free SEPA transfers in EUR
      // const response = await this.bunq.payments.create({
      //   amount: {
      //     value: totalAmount.toFixed(2),
      //     currency: 'EUR'
      //   },
      //   counterpartyAlias: {
      //     type: 'IBAN',
      //     value: this.getBankAccountForWallet(walletAddress),
      //     name: this.getAccountNameForWallet(walletAddress)
      //   },
      //   description: `Donation batch to ${walletAddress.substring(0, 8)}...`,
      //   allowBunqto: false
      // });
      
      logger.info(`Bunq transfer initiated: ${totalAmount} EUR`, {
        reference: reference,
        note: 'Placeholder - Bunq API integration pending'
      });
      
      return {
        type: 'bunq_sepa',
        paymentId: reference,
        amount: totalAmount,
        fee: 0.00, // Bunq: Free SEPA in EUR
        status: 'initiated',
        estimatedCompletion: this.addBusinessDays(new Date(), 1),
        reference: reference,
        donationIds: donationGroup.map(d => d.donationId)
      };
      
    } catch (error) {
      logger.error('Bunq transfer failed:', error);
      throw new Error(`Bunq transfer failed: ${error.message}`);
    }
  }

  /**
   * CYCLE MANAGEMENT: Configurable processing frequency
   */
  async updateProcessingCycle(newCycle, options = {}) {
    const validCycles = ['daily', 'weekly', 'biweekly', 'monthly', 'manual'];
    
    if (!validCycles.includes(newCycle)) {
      throw new Error(`Invalid cycle: ${newCycle}. Valid: ${validCycles.join(', ')}`);
    }
    
    // Check if ProcessingCycle model exists, otherwise create via raw query
    // TODO: Create ProcessingCycle model in database
    const { Op } = models.Sequelize;
    
    try {
      // Try to use model if it exists
      if (models.ProcessingCycle) {
        await models.ProcessingCycle.create({
          cycleType: newCycle,
          effectiveFrom: new Date(),
          changedBy: options.userId || null,
          previousCycle: this.priority.batchCycles.default,
          triggerOnChain: options.triggerOnChain || false,
          triggerBanking: options.triggerBanking !== false,
          minimumAmountEur: options.minimumAmount || this.feeRules.groupingThresholds.minBatchSize,
          isActive: true
        });
      } else {
        // Fallback to raw query until model is created
        await models.sequelize.query(`
          INSERT INTO processing_cycles (
            cycle_type, effective_from, changed_by, previous_cycle,
            trigger_on_chain, trigger_banking, minimum_amount_eur, is_active
          ) VALUES (
            :cycleType, :effectiveFrom, :changedBy, :previousCycle,
            :triggerOnChain, :triggerBanking, :minimumAmount, :isActive
          )
        `, {
          replacements: {
            cycleType: newCycle,
            effectiveFrom: new Date(),
            changedBy: options.userId || null,
            previousCycle: this.priority.batchCycles.default,
            triggerOnChain: options.triggerOnChain || false,
            triggerBanking: options.triggerBanking !== false,
            minimumAmount: options.minimumAmount || this.feeRules.groupingThresholds.minBatchSize,
            isActive: true
          }
        });
      }
      
      // Update in-memory configuration
      this.priority.batchCycles.default = newCycle;
      
      // Schedule/unschedule jobs based on cycle
      await this.adjustScheduledJobs(newCycle);
      
      logger.info(`Processing cycle updated to: ${newCycle}`, options);
      
      return {
        success: true,
        newCycle,
        effectiveFrom: new Date(),
        previousCycle: this.priority.batchCycles.default,
        nextProcessing: this.calculateNextProcessingDate(newCycle)
      };
    } catch (error) {
      logger.error('Failed to update processing cycle:', error);
      throw error;
    }
  }

  /**
   * FEE MINIMIZATION ENGINE
   */
  groupForOptimalFees(donations) {
    const groups = [];
    let currentGroup = [];
    let currentTotal = 0;
    
    // Sort by amount (descending) for optimal grouping
    const sortedDonations = [...donations].sort((a, b) => 
      parseFloat(b.netAmountEur || 0) - parseFloat(a.netAmountEur || 0)
    );
    
    const optimalSize = this.feeRules.groupingThresholds.optimalBatchSize;
    const minSize = this.feeRules.groupingThresholds.minBatchSize;
    
    for (const donation of sortedDonations) {
      const donationAmount = parseFloat(donation.netAmountEur || 0);
      
      // If adding this donation gets us closer to optimal size, add it
      if (currentTotal + donationAmount <= optimalSize * 1.2) { // 20% flexibility
        currentGroup.push(donation);
        currentTotal += donationAmount;
      } else {
        // Current group is optimal, start new group
        if (currentTotal >= minSize) {
          groups.push([...currentGroup]);
        }
        currentGroup = [donation];
        currentTotal = donationAmount;
      }
    }
    
    // Add final group if it meets minimum
    if (currentGroup.length > 0 && currentTotal >= minSize) {
      groups.push(currentGroup);
    }
    
    // If any groups are below minimum, try to merge them
    return this.optimizeGroupMerging(groups, minSize);
  }

  /**
   * DYNAMIC CYCLE ADJUSTMENT
   */
  async adjustCycleBasedOnVolume(volumeData) {
    const { weeklyAverage, donationCount, avgAmount } = volumeData;
    
    // Rules for cycle adjustment
    const rules = [
      {
        condition: weeklyAverage >= 5000 && donationCount >= 20,
        newCycle: 'daily',
        reason: 'High volume, frequent processing reduces accumulation'
      },
      {
        condition: weeklyAverage >= 1000 && weeklyAverage < 5000,
        newCycle: 'weekly',
        reason: 'Moderate volume, weekly is optimal'
      },
      {
        condition: weeklyAverage < 1000 && avgAmount >= 100,
        newCycle: 'biweekly',
        reason: 'Low volume but high individual amounts'
      },
      {
        condition: weeklyAverage < 1000 && avgAmount < 100,
        newCycle: 'monthly',
        reason: 'Low volume, accumulate to minimize fees'
      }
    ];
    
    const applicableRule = rules.find(rule => rule.condition);
    
    if (applicableRule && applicableRule.newCycle !== this.priority.batchCycles.default) {
      logger.info(`Auto-adjusting cycle based on volume: ${applicableRule.newCycle}`, {
        weeklyAverage,
        donationCount,
        reason: applicableRule.reason
      });
      
      return await this.updateProcessingCycle(applicableRule.newCycle, {
        autoAdjust: true,
        volumeData
      });
    }
    
    return { adjusted: false, currentCycle: this.priority.batchCycles.default };
  }

  // Helper methods
  selectOptimalCryptoProvider(amount) {
    const providers = Object.entries(this.feeRules.cryptoFees)
      .map(([name, fees]) => ({
        name,
        totalCost: Math.max(fees.fixed, amount * fees.percent / 100),
        ...fees
      }))
      .filter(p => amount >= p.minAmount)
      .sort((a, b) => a.totalCost - b.totalCost);
    
    return providers[0]?.name || 'simplex'; // Default
  }

  calculateCryptoCost(amount, method) {
    const provider = this.selectOptimalCryptoProvider(amount);
    const fees = this.feeRules.cryptoFees[provider];
    
    return {
      provider,
      fixedFee: fees.fixed,
      percentFee: (amount * fees.percent / 100),
      total: Math.max(fees.fixed, amount * fees.percent / 100),
      effectiveRate: 1 - (Math.max(fees.fixed, amount * fees.percent / 100) / amount)
    };
  }

  isCryptoViable(walletAddress, amount) {
    // Check if wallet is valid TRON address
    if (!TronWeb.isAddress(walletAddress)) return false;
    
    // Check minimum amount for crypto
    if (amount < 50) return false; // Most providers have minimums
    
    // Check if wallet can receive USDT-TRC20 (assumed true for valid TRON address)
    return true;
  }

  getCurrentCycle() {
    return this.priority.batchCycles.default;
  }

  calculateNextProcessingDate(cycle) {
    const now = new Date();
    
    switch (cycle) {
      case 'daily':
        return new Date(now.setDate(now.getDate() + 1));
      case 'weekly':
        return new Date(now.setDate(now.getDate() + 7));
      case 'biweekly':
        return new Date(now.setDate(now.getDate() + 14));
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() + 1));
      default:
        return null; // manual
    }
  }

  addBusinessDays(date, days) {
    const result = new Date(date);
    let added = 0;
    
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        added++;
      }
    }
    
    return result;
  }

  // Placeholder methods (to be implemented)
  async checkInternalCryptoBalances() {
    // TODO: Implement check for internal crypto balances
    return { available: 0 };
  }

  calculateInternalTransferCost(amount) {
    return { total: 0, provider: 'internal' };
  }

  calculateP2PCost(amount) {
    return { total: amount * 0.01, provider: 'p2p_market' }; // 1% estimate
  }

  createExecutionPlan(strategy, walletAddress, totalAmount) {
    return {
      steps: ['purchase_crypto', 'send_to_wallet', 'verify_transaction'],
      estimatedCost: strategy.cost.total,
      estimatedTime: strategy.speed
    };
  }

  async executeSimplexPurchase(group, walletAddress) {
    // TODO: Integrate with Simplex service
    logger.info(`Simplex purchase placeholder for ${walletAddress}`);
    return { status: 'placeholder', provider: 'simplex' };
  }

  async executeRevolutCrypto(group, walletAddress) {
    // TODO: Implement Revolut crypto integration
    logger.info(`Revolut crypto placeholder for ${walletAddress}`);
    return { status: 'placeholder', provider: 'revolut' };
  }

  async executeInternalCryptoTransfer(group, walletAddress) {
    // TODO: Implement internal crypto transfer
    logger.info(`Internal crypto transfer placeholder for ${walletAddress}`);
    return { status: 'placeholder', provider: 'internal' };
  }

  async executeP2PPurchase(group, walletAddress) {
    // TODO: Implement P2P purchase
    logger.info(`P2P purchase placeholder for ${walletAddress}`);
    return { status: 'placeholder', provider: 'p2p_market' };
  }

  async verifyCryptoTransactions(steps) {
    // TODO: Implement transaction verification
    return { allConfirmed: false, verified: 0, total: steps.length };
  }

  async markDonationsAsProcessed(donations, results) {
    const { Op } = models.Sequelize;
    const donationIds = donations.map(d => d.donationId);
    
    await models.Donation.update(
      { 
        status: 'sent',
        processedAt: new Date()
      },
      {
        where: {
          donationId: {
            [Op.in]: donationIds
          }
        }
      }
    );
  }

  async markDonationsAsBankTransferred(donations, results) {
    const { Op } = models.Sequelize;
    const donationIds = donations.map(d => d.donationId);
    
    await models.Donation.update(
      { 
        status: 'batched',
        processedAt: new Date()
      },
      {
        where: {
          donationId: {
            [Op.in]: donationIds
          }
        }
      }
    );
  }

  async initiateFallback(walletAddress, donations, error) {
    logger.error(`Initiating fallback for ${walletAddress} due to error:`, error);
    // TODO: Implement fallback logic
  }

  async flagForManualIntervention(walletAddress, donations, error) {
    logger.error(`Flagging ${walletAddress} for manual intervention:`, error);
    // TODO: Create alert/notification for manual intervention
  }

  groupForBankTransfers(donations) {
    // Simple grouping for bank transfers (similar to crypto grouping)
    return this.groupForOptimalFees(donations);
  }

  optimizeGroupMerging(groups, minSize) {
    // Simple optimization: merge small groups if total is below minimum
    const merged = [];
    let tempGroup = [];
    let tempTotal = 0;
    
    for (const group of groups) {
      const groupTotal = group.reduce((sum, d) => sum + parseFloat(d.netAmountEur || 0), 0);
      
      if (tempTotal + groupTotal < minSize) {
        tempGroup = tempGroup.concat(group);
        tempTotal += groupTotal;
      } else {
        if (tempGroup.length > 0) {
          merged.push(tempGroup);
        }
        merged.push(group);
        tempGroup = [];
        tempTotal = 0;
      }
    }
    
    if (tempGroup.length > 0) {
      merged.push(tempGroup);
    }
    
    return merged.length > 0 ? merged : groups;
  }

  generateSummary(results) {
    const total = results.reduce((sum, r) => sum + r.donationsProcessed, 0);
    const completed = results.filter(r => r.status === 'completed').length;
    
    return {
      totalDonations: total,
      completedBatches: completed,
      totalBatches: results.length,
      successRate: (completed / results.length * 100).toFixed(1) + '%'
    };
  }

  async adjustScheduledJobs(cycle) {
    // TODO: Implement job scheduling adjustment based on cycle
    logger.info(`Adjusting scheduled jobs for cycle: ${cycle}`);
  }

  getBankAccountForWallet(walletAddress) {
    // TODO: Map wallet addresses to bank accounts if available
    return null;
  }

  getAccountNameForWallet(walletAddress) {
    // TODO: Get account name for wallet
    return 'Campaign Wallet';
  }
}

module.exports = new BunqCryptoFirstService();
