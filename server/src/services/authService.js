const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

class AuthService {
  // Hash password with bcrypt (10 rounds = industry standard)
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // Compare password with hash
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  // Generate JWT access token
  generateAccessToken(userId, email, role) {
    return jwt.sign(
      { userId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
  }

  // Generate JWT refresh token
  generateRefreshToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
    );
  }

  // Verify access token
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Register new user (Doctor/Patient)
  async register({ email, password, fullName, role, phone, licenseNumber }) {
    try {
      // Check if user already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Insert user
      const result = await query(
        `INSERT INTO users (email, password_hash, full_name, role, phone, license_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, full_name, role, created_at`,
        [email, passwordHash, fullName, role, phone, licenseNumber]
      );

      const user = result.rows[0];

      // Generate tokens
      const accessToken = this.generateAccessToken(user.id, user.email, user.role);
      const refreshToken = this.generateRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Find user
      const result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await this.comparePassword(password, user.password_hash);

      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(user.id, user.email, user.role);
      const refreshToken = this.generateRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Get user details
      const result = await query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];
      const newAccessToken = this.generateAccessToken(user.id, user.email, user.role);

      return { accessToken: newAccessToken };
    } catch (error) {
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      const result = await query(
        'SELECT id, email, full_name, role, phone, verified FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthService();
