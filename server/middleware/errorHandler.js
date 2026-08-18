// Centralized error handling for the API.
//
// The project runs on Express 5, which automatically forwards errors thrown
// (or rejected) by `async` route handlers to the error-handling middleware.
// So we don't need to wrap every controller in a try/catch or asyncHandler —
// any unhandled failure lands here and get a clean JSON response instead of
// hanging the request or crashing the process.

// 404 for any route that didn't match. Registered AFTER all real routes.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// Final error handler. Must be registered LAST and must take 4 arguments so
// Express recognizes it as error-handling middleware.
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  // Structured server-side log: timestamp, method, path, status, error type, and stack.
  // Stack is only logged for 5xx (server bugs); 4xx are client errors and noisy.
  const logPayload = {
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    status,
    message: err.message,
    ...(status >= 500 && err.stack ? { stack: err.stack.split('\n').slice(0, 8).join('\n') } : {}),
  };
  if (status >= 500) {
    console.error('[ERROR]', JSON.stringify(logPayload));
  } else {
    console.warn('[WARN]', JSON.stringify(logPayload));
  }

  // If the response already started streaming, defer to Express's default handler.
  if (res.headersSent) return next(err);

  // Don't leak internal error details for 500s; pass through intentional messages otherwise.
  const message = status >= 500 ? 'Internal server error' : (err.message || 'Request failed');

  res.status(status).json({ error: message });
}
