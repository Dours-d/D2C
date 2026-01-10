const models = require('../database/models');
const AuthUtils = require('../utils/auth');

/**
 * Authentication Controller
 */
class AuthController {
  /**
   * Login
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Find user by username or email
      const { Op } = require('sequelize');
      const user = await models.User.findOne({
        where: {
          [Op.or]: [
            { username },
            { email: username }
          ]
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      // Verify password
      const isValidPassword = await AuthUtils.comparePassword(password, user.passwordHash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await user.update({ lastLogin: new Date() });

      // Generate token
      const token = AuthUtils.generateToken(user);

      res.json({
        success: true,
        token,
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  /**
   * Get current user
   * GET /api/auth/me
   */
  async getMe(req, res) {
    try {
      const user = await models.User.findByPk(req.user.userId, {
        attributes: ['userId', 'username', 'email', 'role', 'createdAt', 'lastLogin']
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  }

  /**
   * Logout (client-side token removal, but we can track it)
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      // In a stateless JWT system, logout is handled client-side
      // But we can log the action for audit purposes
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
}

module.exports = new AuthController();
