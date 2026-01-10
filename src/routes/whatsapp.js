const express = require('express');
const router = express.Router();
const WhatsAppController = require('../controllers/WhatsAppController');
const { authenticate, adminOrOperator } = require('../middleware/auth');

router.post('/scan', authenticate, adminOrOperator, WhatsAppController.scan.bind(WhatsAppController));
router.get('/scans', authenticate, WhatsAppController.listScans.bind(WhatsAppController));
router.get('/scans/:id', authenticate, WhatsAppController.getScan.bind(WhatsAppController));
router.get('/chats', authenticate, WhatsAppController.listChats.bind(WhatsAppController));
router.post('/chats/:id/process', authenticate, adminOrOperator, WhatsAppController.processChat.bind(WhatsAppController));
router.get('/numbers', authenticate, WhatsAppController.listNumbers.bind(WhatsAppController));
router.post('/webhook', WhatsAppController.webhook.bind(WhatsAppController)); // No auth for webhook
router.post('/send', authenticate, adminOrOperator, WhatsAppController.sendMessage.bind(WhatsAppController));

module.exports = router;
