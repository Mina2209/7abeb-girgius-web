// Lightweight structured logger.
// Follows the [LEVEL] + JSON pattern used by errorHandler.js and requestLogger.
// In development, pretty-prints to console; in production, emits one-liner JSON.

const isProd = process.env.NODE_ENV === 'production';

function emit(level, msg, meta) {
  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    ...(meta && Object.keys(meta).length ? { meta } : {}),
  };
  const line = isProd ? JSON.stringify(entry) : `[${level}] ${msg}` + (meta ? ' ' + JSON.stringify(meta) : '');

  switch (level) {
    case 'ERROR':
      console.error(line);
      break;
    case 'WARN':
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  info: (msg, meta) => emit('INFO', msg, meta),
  warn: (msg, meta) => emit('WARN', msg, meta),
  error: (msg, meta) => emit('ERROR', msg, meta),
};
