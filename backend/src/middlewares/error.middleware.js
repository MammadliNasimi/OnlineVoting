const logger = require('../utils/logger');

// Catch Async Errors and pass them to the global error handler
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Global Error Handler Middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  
  logger.error(
    `${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip} - ${err.stack}`
  );

  res.status(statusCode).json({
    status: statusCode,
    message: err.message || 'Sunucu hatası',
    code: err.code || 'ERR_01'
  });
};

class CustomError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, catchAsync, CustomError };
