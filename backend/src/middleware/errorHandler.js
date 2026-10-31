import { AppError } from '../utils/AppError.js';

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'A record with this value already exists' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
}