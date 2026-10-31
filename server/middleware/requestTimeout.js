// Per-request timeout policy.
//
// The default budget is deliberately short: a normal JSON API request that takes
// more than 30s is almost always stuck, and holding the socket open only delays
// the client's own error handling. The streaming zip endpoints are exempt
// entirely — a large archive legitimately takes minutes, and killing it
// mid-stream at 30s was the bug this middleware originally fixed.
//
// PowerPoint image previews are the one non-streaming case with a legitimate
// reason to run long: the FIRST view of a deck converts it with LibreOffice and
// then rasterises every slide with poppler before it can answer. That work is
// bounded by ppsx-converter's conversion timeout (120s, plus a possible
// clip-guard re-conversion) and slide-images' RENDER_TIMEOUT_MS (300s). The
// frontend already waits up to 180s (PptxViewer PREVIEW_FETCH_TIMEOUT_MS), so the
// server matches that 180s budget and lets the client's own deadline normally
// win. The mismatch with the 300s renderer bound is intentional and unavoidable:
// if a render runs past 180s the server answers 504 and tears the socket down,
// but the handler keeps running to completion in the background, so the user's
// retry is served from a now-warm cache. The budget is still finite — this is not
// an unbounded request.

export const DEFAULT_REQUEST_TIMEOUT_MS = 30 * 1000;
// Matches the frontend's PREVIEW_FETCH_TIMEOUT_MS in PptxViewer.tsx.
export const PREVIEW_IMAGES_TIMEOUT_MS = 180 * 1000;
export const PREVIEW_IMAGES_PATH = '/api/uploads/preview/images';

// 0 means "no timeout". Only the streaming zip endpoints use it (unchanged
// behaviour); every other path is bounded.
function isStreamingPath(path) {
  return path === '/zip' || (typeof path === 'string' && path.endsWith('/zip'));
}

function isPreviewImagesPath(path) {
  return path === PREVIEW_IMAGES_PATH
    || (typeof path === 'string' && path.endsWith('/preview/images'));
}

/**
 * Timeout budget in milliseconds for a request path (0 = unbounded). Exported so
 * the policy can be asserted without waiting out a real deadline.
 */
export function timeoutBudgetForPath(path, {
  defaultMs = DEFAULT_REQUEST_TIMEOUT_MS,
  previewImagesMs = PREVIEW_IMAGES_TIMEOUT_MS,
} = {}) {
  if (isStreamingPath(path)) return 0;
  if (isPreviewImagesPath(path)) return previewImagesMs;
  return defaultMs;
}

/**
 * Build the timeout middleware. The budgets are injectable so tests can drive
 * the timer without waiting 30–180 real seconds.
 */
export function createRequestTimeout(options = {}) {
  return function requestTimeout(req, res, next) {
    const budget = timeoutBudgetForPath(req.path, options);
    if (!budget) return next();

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;

      // Already answered, or the peer is gone: writing now would be a second
      // response (ERR_HTTP_HEADERS_SENT) or a write to a dead socket.
      if (res.writableEnded || res.destroyed || req.destroyed) return;

      // A handler that has already begun streaming cannot be answered, so it is
      // only torn down; otherwise the client gets the explicit 504.
      if (!res.headersSent) {
        res.status(504).json({ error: 'Gateway timeout' });
      }
      req.destroy();
    }, budget);

    const clear = () => {
      settled = true;
      clearTimeout(timer);
    };
    res.on('finish', clear);
    res.on('close', clear);
    next();
  };
}

export const requestTimeout = createRequestTimeout();
export default requestTimeout;
