const express = require('express');
const router = express.Router();
const BatchController = require('../controllers/BatchController');
const { authenticate, adminOrOperator } = require('../middleware/auth');

router.get('/', authenticate, BatchController.list.bind(BatchController));
router.get('/reserve-summary', authenticate, BatchController.getReserveSummary.bind(BatchController));
router.post('/', authenticate, adminOrOperator, BatchController.create.bind(BatchController));
router.get('/:id', authenticate, BatchController.getById.bind(BatchController));
router.get('/:id/status', authenticate, BatchController.getStatus.bind(BatchController));
router.get('/:id/reserve', authenticate, BatchController.getReserve.bind(BatchController));
router.post('/:id/process', authenticate, adminOrOperator, BatchController.process.bind(BatchController));
router.post('/:id/initiate-simplex', authenticate, adminOrOperator, BatchController.initiateSimplex.bind(BatchController));
router.post('/:id/simplex-callback', BatchController.simplexCallback.bind(BatchController)); // No auth for webhook
router.post('/:id/send-tron', authenticate, adminOrOperator, BatchController.sendTron.bind(BatchController));
router.delete('/:id', authenticate, adminOrOperator, BatchController.cancel.bind(BatchController));

module.exports = router;
