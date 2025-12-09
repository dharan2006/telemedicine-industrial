const authService = require('../services/authService');

// Verify JWT token from request headers
const authenticateToken = (req, res, next) => {
  try {
    // Get token from Authorization header: "Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    const decoded = authService.verifyAccessToken(token);
    
    // Attach user info to request object
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
      error: 'Invalid or expired token' 
    });
  }
};

// Check if user is a doctor
const requireDoctor = (req, res, next) => {
  if (req.user.role !== 'doctor') {
    return res.status(403).json({ 
      error: 'Access denied. Doctors only.' 
    });
  }
  next();
};

// Check if user is a patient
const requirePatient = (req, res, next) => {
  if (req.user.role !== 'patient') {
    return res.status(403).json({ 
      error: 'Access denied. Patients only.' 
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireDoctor,
  requirePatient,
};
