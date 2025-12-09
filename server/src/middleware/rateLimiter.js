const rateLimit = require('express-rate-limit');

// General API rate limiter (100 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints (5 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// Room creation limiter (10 rooms per hour per doctor)
const roomCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: 'Room creation limit reached. Please wait before creating more rooms.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  roomCreationLimiter,
};
