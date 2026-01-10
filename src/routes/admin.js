const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/dashboard', authenticate, adminOnly, AdminController.getDashboard.bind(AdminController));
router.post('/config', authenticate, adminOnly, AdminController.updateConfig.bind(AdminController));
router.get('/logs', authenticate, adminOnly, AdminController.getLogs.bind(AdminController));
router.post('/backup', authenticate, adminOnly, AdminController.backup.bind(AdminController));

module.exports = router;
