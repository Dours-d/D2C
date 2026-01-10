const express = require('express');
const router = express.Router();
const ExchangeRateService = require('../services/ExchangeRateService');
const { authenticate, adminOrOperator } = require('../middleware/auth');

router.get('/currencies', authenticate, async (req, res) => {
  try {
    const models = require('../database/models');
    const currencies = await models.Currency.findAll();
    res.json({ success: true, currencies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get currencies' });
  }
});

router.get('/exchange-rates', authenticate, async (req, res) => {
  try {
    const { baseCurrency, targetCurrency } = req.query;
    
    if (!baseCurrency || !targetCurrency) {
      return res.status(400).json({ error: 'Base and target currencies are required' });
    }

    const rate = await ExchangeRateService.getExchangeRate(baseCurrency, targetCurrency);
    res.json({ success: true, rate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/exchange-rates/refresh', authenticate, adminOrOperator, async (req, res) => {
  try {
    const results = await ExchangeRateService.refreshRates();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/exchange-rates/history', authenticate, async (req, res) => {
  try {
    const { baseCurrency, targetCurrency, limit = 30 } = req.query;
    
    if (!baseCurrency || !targetCurrency) {
      return res.status(400).json({ error: 'Base and target currencies are required' });
    }

    const history = await ExchangeRateService.getRateHistory(baseCurrency, targetCurrency, parseInt(limit));
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
