const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticate } = require('../middleware/auth');

router.post('/login', AuthController.login.bind(AuthController));
router.post('/logout', authenticate, AuthController.logout.bind(AuthController));
router.get('/me', authenticate, AuthController.getMe.bind(AuthController));

module.exports = router;
