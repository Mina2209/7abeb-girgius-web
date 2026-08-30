import { randomUUID } from 'node:crypto';

/**
 * Request ID correlation middleware (Task 8 / Finding 10).
 *
 * Generates a unique ID per request, attaches it to `req.id`, and echoes it in
 * the `X-Request-ID` response header so a client can hand it back when
 * reporting an error. All log lines produced by the app (requestLogger,
 * errorHandler) include the ID for cross-referencing during investigation.
 */
export function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}

export default requestId;