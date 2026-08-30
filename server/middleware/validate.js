/**
 * Lightweight request body validation middleware (no external dependencies).
 *
 * Usage:
 *   router.post('/', validate({ name: 'string', bio: 'string?' }), handler)
 *
 * Supported types:
 *   'string'     – required string, trimmed, must be non-empty
 *   'string?'    – optional string (ignored if absent); if present, trimmed & must be non-empty
 *   'number'     – required finite number
 *   'number?'    – optional finite number
 *   'boolean'    – required boolean
 *   'boolean?'   – optional boolean
 *   'array'      – required array (any elements)
 *   'array?'     – optional array
 *
 * Length / element constraints (max-length enforcement):
 *   'string:255'       – string with a maximum length of 255 characters
 *   'string?:255'      – optional string with a maximum length of 255 characters
 *   'array:100'        – array with at most 100 items
 *   'array?:100'       – optional array with at most 100 items
 *   'string[]:100'     – array whose items must be non-empty strings (max 100 items)
 *   'string[]?:100'    – optional above
 *   'string[]:100:255' – string array, max 100 items, each item ≤ 255 characters
 */

function parseType(rawType) {
  // "string?:255:100" → basePart "string?", max 255, elementMax 100
  const parts = rawType.split(':');
  let basePart = parts[0];
  const optional = basePart.endsWith('?');
  if (optional) basePart = basePart.slice(0, -1);
  return {
    base: basePart,
    optional,
    max: parts[1] !== undefined ? Number(parts[1]) : undefined,
    elementMax: parts[2] !== undefined ? Number(parts[2]) : undefined,
  };
}

function validateField(value, parsed) {
  const { base, max, elementMax } = parsed;

  switch (base) {
    case 'string': {
      if (typeof value !== 'string') return { ok: false, error: `must be a string` };
      const trimmed = value.trim();
      if (!trimmed) return { ok: false, error: `must not be empty` };
      if (max !== undefined && trimmed.length > max) {
        return { ok: false, error: `must not exceed ${max} characters` };
      }
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
    case 'string[]': {
      if (!Array.isArray(value)) return { ok: false, error: `must be an array` };
      if (max !== undefined && value.length > max) {
        return { ok: false, error: `must not exceed ${max} items` };
      }
      const cleaned = [];
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item !== 'string') {
          return { ok: false, error: `item ${i} must be a string` };
        }
        const trimmed = item.trim();
        if (!trimmed) return { ok: false, error: `item ${i} must not be empty` };
        if (elementMax !== undefined && trimmed.length > elementMax) {
          return { ok: false, error: `item ${i} must not exceed ${elementMax} characters` };
        }
        cleaned.push(trimmed);
      }
      return { ok: true, value: cleaned };
    }
    case 'array': {
      if (!Array.isArray(value)) return { ok: false, error: `must be an array` };
      if (max !== undefined && value.length > max) {
        return { ok: false, error: `must not exceed ${max} items` };
      }
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
      const parsed = parseType(effectiveType);

      const value = req.body?.[field];
      if (value === undefined || value === null) {
        if (!parsed.optional) errors.push(`${field} is required`);
        continue;
      }

      const result = validateField(value, parsed);
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