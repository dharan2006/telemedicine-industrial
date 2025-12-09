const authService = require('../services/authService');

class AuthController {
  // POST /api/auth/register
  async register(req, res) {
    try {
      const { email, password, fullName, role, phone, licenseNumber } = req.body;

      // Validation
      if (!email || !password || !fullName || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      if (!['doctor', 'patient'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const result = await authService.register({
        email,
        password,
        fullName,
        role,
        phone,
        licenseNumber,
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result,
      });
    } catch (error) {
      console.error('Register controller error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const result = await authService.login(email, password);

      res.json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      console.error('Login controller error:', error);
      res.status(401).json({ error: error.message });
    }
  }

  // POST /api/auth/refresh
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  // GET /api/auth/me
  async getProfile(req, res) {
    try {
      const user = await authService.getUserById(req.user.userId);
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
}

// Export instance with bound methods
const controller = new AuthController();
module.exports = {
  register: controller.register.bind(controller),
  login: controller.login.bind(controller),
  refreshToken: controller.refreshToken.bind(controller),
  getProfile: controller.getProfile.bind(controller),
};
