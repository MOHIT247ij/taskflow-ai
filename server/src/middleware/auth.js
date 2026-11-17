const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError } = require('../utils/http');

// Stateless JWT auth -> any API instance can serve any request (horizontal scaling)
function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Not authenticated'));
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.userId = payload.sub;
    next();
  } catch {
    next(new ApiError(401, 'Session expired, please log in again'));
  }
}

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

module.exports = { protect, signToken };
