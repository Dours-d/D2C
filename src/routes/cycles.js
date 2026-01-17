const express = require('express');
const router = express.Router();
const CycleController = require('../controllers/CycleController');
const { authenticate, adminOrOperator } = require('../middleware/auth');

// Get current cycle configuration
router.get('/current', authenticate, CycleController.getCurrentCycle.bind(CycleController));

// Update processing cycle (admin only)
router.put('/', authenticate, adminOrOperator, CycleController.updateCycle.bind(CycleController));

// Trigger processing
router.post('/trigger', authenticate, adminOrOperator, CycleController.triggerProcessing.bind(CycleController));

// Get execution history
router.get('/history', authenticate, adminOrOperator, CycleController.getHistory.bind(CycleController));

// Get optimization suggestions
router.get('/optimization', authenticate, adminOrOperator, CycleController.getOptimization.bind(CycleController));

module.exports = router;
