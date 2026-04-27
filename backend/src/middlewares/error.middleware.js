const logger = require('../utils/logger');

const catchAsync = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
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
