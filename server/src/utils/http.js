class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Wraps async route handlers so rejected promises reach the error middleware
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Minimal declarative validator: { field: { required, type, enum, max } }
function validate(schema) {
  return (req, _res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      const empty = value === undefined || value === null || value === '';
      if (rules.required && empty) {
        errors.push(`${field} is required`);
        continue;
      }
      if (empty) continue;
      if (rules.type === 'string' && typeof value !== 'string') errors.push(`${field} must be a string`);
      if (rules.type === 'number' && typeof value !== 'number') errors.push(`${field} must be a number`);
      if (rules.type === 'array' && !Array.isArray(value)) errors.push(`${field} must be an array`);
      if (rules.enum && !rules.enum.includes(value)) errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      if (rules.max && typeof value === 'string' && value.length > rules.max) errors.push(`${field} must be at most ${rules.max} characters`);
      if (rules.min && typeof value === 'string' && value.length < rules.min) errors.push(`${field} must be at least ${rules.min} characters`);
      if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${field} must be a valid email`);
    }
    if (errors.length) return next(new ApiError(400, 'Validation failed', errors));
    next();
  };
}

module.exports = { ApiError, asyncHandler, validate };
