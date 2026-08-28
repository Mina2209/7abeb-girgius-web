/**
 * Lightweight request body validation middleware (no external dependencies).
 *
 * Usage:
 *   router.post('/', validate({ name: 'string', bio: 'string?' }), handler)
 *
 * Supported types:
 *   'string'    – required string, trimmed, must be non-empty
 *   'string?'   – optional string (ignored if absent); if present, trimmed & must be non-empty
 *   'number'    – required finite number
 *   'number?'   – optional finite number
 *   'boolean'   – required boolean
 *   'boolean?'  – optional boolean
 *   'array'     – required array
 *   'array?'    – optional array
 */

const TRIMMABLE = 'string';

function validateField(value, type) {
  const optional = type.endsWith('?');
  const base = optional ? type.slice(0, -1) : type;

  if (value === undefined || value === null) {
    if (optional) return { ok: true, value: undefined };
    return { ok: false, error: `is required` };
  }

  switch (base) {
    case TRIMMABLE: {
      if (typeof value !== 'string') return { ok: false, error: `must be a string` };
      const trimmed = value.trim();
      if (!trimmed) return { ok: false, error: `must not be empty` };
      return { ok: true, value: trimmed };
    }
    case 'number': {
      const n = Number(value);
      if (!Number.isFinite(n)) return { ok: false, error: `must be a number` };
      return { ok: true, value: n };
    }
    case 'boolean': {
      if (typeof value !== 'boolean') return { ok: false, error: `must be a boolean` };
      return { ok: true, value };
    }
    case 'array': {
      if (!Array.isArray(value)) return { ok: false, error: `must be an array` };
      return { ok: true, value };
    }
    default:
      return { ok: true, value };
  }
}

/**
 * Create an Express middleware that validates req.body against the given schema.
 * On failure, responds 400 with a descriptive error message.
 * On success, replaces req.body with the sanitized (trimmed) values.
 *
 * @param {Record<string, string>} schema - Map of field name → type string
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const sanitized = {};

    for (const [rawField, type] of Object.entries(schema)) {
      const fieldOptional = rawField.endsWith('?');
      const field = fieldOptional ? rawField.slice(0, -1) : rawField;
      const effectiveType = fieldOptional && !type.endsWith('?') ? type + '?' : type;
      const result = validateField(req.body?.[field], effectiveType);
      if (!result.ok) {
        errors.push(`${field} ${result.error}`);
      } else if (result.value !== undefined) {
        sanitized[field] = result.value;
      }
    }

    if (errors.length > 0) {
      console.warn('[VALIDATE] 400:', errors.join('; '), 'body keys:', Object.keys(req.body || {}));
      return res.status(400).json({ error: errors.join('; ') });
    }

    // Replace body with ONLY the fields declared in the schema (plus their sanitized values).
    // Unvalidated/unknown fields are stripped so they never reach the service layer.
    req.body = { ...sanitized };
    next();
  };
}
