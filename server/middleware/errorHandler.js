// Centralized error handling for the API.
//
// The project runs on Express 5, which automatically forwards errors thrown
// (or rejected) by `async` route handlers to the error-handling middleware.
// So we don't need to wrap every controller in a try/catch or asyncHandler —
// any unhandled failure lands here and gets a clean JSON response instead of
// hanging the request or crashing the process.

// 404 for any route that didn't match. Registered AFTER all real routes.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// Final error handler. Must be registered LAST and must take 4 arguments so
// Express recognizes it as error-handling middleware.
export function errorHandler(err, req, res, next) {
  // Always log the full error server-side for debugging.
  console.error(`[ERROR] ${req.method} ${req.originalUrl} —`, err);

  // If the response already started streaming, defer to Express's default handler.
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  // Don't leak internal error details for 500s; pass through intentional messages otherwise.
  const message = status >= 500 ? 'Internal server error' : (err.message || 'Request failed');

  res.status(status).json({ error: message });
}
