import archiver from 'archiver';
import { HymnService } from '../services/hymn.service.js';
import { normalizeArabic } from '../services/normalize.js';
import { logService } from '../services/log.service.js';
import s3Service from '../services/s3.service.js';
import { downloadGuard } from '../services/downloadGuard.js';

// Fallback extension per file type when a file has no stored original name.
const FILE_TYPE_EXT = {
  MUSIC_AUDIO: 'mp3',
  POWERPOINT: 'pptx',
  VIDEO_POWERPOINT: 'mp4',
  VIDEO_MONTAGE: 'mp4',
};

// Our file URLs look like `.../api/uploads/url?key=<S3 key>`. Pull the key back out so we
// can stream the object straight from S3.
function keyFromFileUrl(fileUrl) {
  if (!fileUrl) return null;
  const idx = fileUrl.indexOf('key=');
  if (idx === -1) return null;
  return decodeURIComponent(fileUrl.slice(idx + 4).split('&')[0]) || null;
}

// Strip characters that are unsafe inside a zip path segment, keep Unicode (Arabic) names.
function sanitizeSegment(name) {
  return String(name || '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 150) || 'ملف';
}

// Ensure each entry name inside the zip is unique (append " (2)", " (3)", … on collision).
function uniqueName(used, name) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

// Build the entry filename for a file: prefer its real original name, else title + ext.
function entryFileName(file, hymnTitle) {
  const original = (file.originalName || '').trim();
  if (original && !/^https?:\/\//i.test(original) && !original.includes('/')) {
    return sanitizeSegment(original);
  }
  const ext = FILE_TYPE_EXT[file.type] || 'bin';
  return `${sanitizeSegment(hymnTitle || 'ترنيمة')}.${ext}`;
}

// Set a Content-Disposition that carries the real (possibly Arabic) zip name across the
// wire: ASCII fallback + RFC 5987 UTF-8 form.
function setZipHeaders(res, zipName) {
  res.set('Content-Type', 'application/zip');
  const ascii = zipName.replace(/[^\x20-\x7E]/g, '_');
  const utf8 = encodeURIComponent(zipName).replace(/'/g, '%27');
  res.set('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`);
  // Long-running stream: don't let an idle proxy buffer or cut it short.
  res.set('Cache-Control', 'no-store');
}

export const HymnController = {
  // Stream a zip of one or more hymns' files, straight from S3 (constant memory).
  // GET /api/hymns/zip?ids=id1,id2,...   (one id → flat zip; many → one folder per hymn)
  downloadZip: async (req, res) => {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: 'no hymn ids provided' });

    // Admission control: only proceed if the server has spare capacity, otherwise ask the
    // client to retry. This keeps downloads from starving the app / co-located database.
    const slot = downloadGuard.tryAcquire();
    if (!slot.ok) {
      res.set('Retry-After', '10');
      return res
        .status(503)
        .json({ error: 'الخادم مشغول حالياً، حاول بعد قليل', reason: slot.reason });
    }

    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        downloadGuard.release();
      }
    };

    try {
      const hymns = [];
      for (const id of ids) {
        const h = await HymnService.getById(id);
        if (h) hymns.push(h);
      }
      if (hymns.length === 0) {
        release();
        return res.status(404).json({ error: 'no matching hymns' });
      }

      const multi = hymns.length > 1;
      const zipName = multi ? 'ترانيم.zip' : `${sanitizeSegment(hymns[0].title)}.zip`;
      setZipHeaders(res, zipName);

      // store=true: no compression. Hymn media (mp3/mp4/pptx) is already compressed, so this
      // saves CPU and just bundles the files into one container.
      const archive = archiver('zip', { store: true });

      archive.on('warning', (err) => console.warn('[zip] warning:', err?.message || err));
      archive.on('error', (err) => {
        console.error('[zip] archive error:', err);
        release();
        if (!res.headersSent) res.status(500).json({ error: 'zip failed' });
        else res.destroy();
      });

      // Free the slot (and stop pulling from S3) whenever the response ends — normal finish
      // or the client disconnecting mid-download.
      res.on('close', () => {
        release();
        archive.destroy();
      });

      archive.pipe(res);

      const used = new Set();
      for (const hymn of hymns) {
        if (res.destroyed) break; // client disconnected — stop pulling from S3
        const folder = multi ? `${sanitizeSegment(hymn.title)}/` : '';
        for (const file of hymn.files || []) {
          if (res.destroyed) break;
          const key = keyFromFileUrl(file.fileUrl);
          if (!key) continue;
          const name = folder + uniqueName(used, entryFileName(file, hymn.title));
          try {
            const stream = await s3Service.getObjectStream(key);
            archive.append(stream, { name });
          } catch (e) {
            // Skip a missing/unreadable object rather than failing the whole bundle.
            console.error('[zip] skipping file (S3 error):', key, e?.message || e);
          }
        }
      }

      await archive.finalize();
    } catch (err) {
      console.error('[zip] downloadZip error:', err);
      release();
      if (!res.headersSent) res.status(500).json({ error: 'download failed' });
      else res.destroy();
    }
  },

  getAll: async (req, res) => {
    const hymns = await HymnService.getAll();

    // --- Query params ---
    // search / q: free-text over title + tag names (Arabic-normalized)
    const searchRaw = req.query.search || req.query.q || '';
    const search = searchRaw ? normalizeArabic(String(searchRaw)) : '';

    // tags=tag1,tag2 (matches exact tag name)
    const tagsRaw = req.query.tags;
    const tags = typeof tagsRaw === 'string'
      ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean)
      : Array.isArray(tagsRaw)
        ? tagsRaw.map(String)
        : [];

    // fileTypes=Video PowerPoint,Music (matches HymnFile.type, i.e. backend enums mapped in client)
    const fileTypesRaw = req.query.fileTypes;
    const fileTypes = typeof fileTypesRaw === 'string'
      ? fileTypesRaw.split(',').map(s => s.trim()).filter(Boolean)
      : Array.isArray(fileTypesRaw)
        ? fileTypesRaw.map(String)
        : [];

    // favorites=true (client currently keeps favorites in-memory; server implementation added for completion)
    // For now: only enable filtering if backend supports favorites; otherwise no-op.
    const favoritesOnly = String(req.query.favorites || '').toLowerCase() === 'true';

    // sort=alpha-asc|alpha-desc|length-asc|length-desc|date-asc|date-desc
    const sort = String(req.query.sort || 'alpha-asc');

    const normalizeTag = (t) => normalizeArabic(t || '');

    const matchSearch = (h) => {
      if (!search) return true;
      const title = normalizeArabic(h.title || '');
      if (title.includes(search)) return true;
      const tagMatch = Array.isArray(h.tags) && h.tags.some(t => normalizeTag(t?.name).includes(search));
      return tagMatch;
    };

    const matchTags = (h) => {
      if (!tags.length) return true;
      const hymnTagNames = (h.tags || []).map(t => t.name);
      // Exact match against provided tag strings.
      return tags.some(t => hymnTagNames.includes(t));
    };

    const matchFileTypes = (h) => {
      if (!fileTypes.length) return true;
      const hymnTypes = new Set((h.files || []).map(f => String(f.type)));
      // Client passes the mapped fileType labels (e.g. "Music", "PowerPoint file").
      // DB enum values are like VIDEO_MONTAGE / MUSIC_AUDIO, so we map them back.
      const FILE_TYPE_MAP = {
        VIDEO_MONTAGE: 'Video montage',
        VIDEO_POWERPOINT: 'Video PowerPoint',
        POWERPOINT: 'PowerPoint file',
        MUSIC_AUDIO: 'Music',
      };
      return fileTypes.some((clientType) => {
        for (const dbType of hymnTypes) {
          const mapped = FILE_TYPE_MAP[dbType];
          if (mapped === clientType) return true;
        }
        return false;
      });
    };

    const filtered = hymns.filter(h => {
      if (!matchSearch(h)) return false;
      if (!matchTags(h)) return false;
      if (!matchFileTypes(h)) return false;

      // Favorites filtering placeholder (no favorites model in provided server routes).
      if (favoritesOnly) {
        // No server-side favorites implemented yet -> keep all.
        // If you add a Favorite model later, filter here using req.user.
      }

      return true;
    });

    const durationToSeconds = (h) => {
      // Client expects duration based on max duration among files.
      const durations = (h.files || [])
        .map(f => f.duration)
        .filter(d => typeof d === 'number' && Number.isFinite(d));
      const max = durations.length ? Math.max(...durations) : 0;
      // durations stored in DB appear to be seconds.
      return max;
    };

    const sorted = filtered.sort((a, b) => {
      switch (sort) {
        case 'alpha-desc':
          return String(b.title || '').localeCompare(String(a.title || ''), 'ar');
        case 'length-asc':
          return durationToSeconds(a) - durationToSeconds(b);
        case 'length-desc':
          return durationToSeconds(b) - durationToSeconds(a);
        case 'date-asc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'date-desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'alpha-asc':
        default:
          return String(a.title || '').localeCompare(String(b.title || ''), 'ar');
      }
    });

    res.json(sorted);
  },

  getById: async (req, res) => {
    const hymn = await HymnService.getById(req.params.id);
    if (!hymn) return res.status(404).json({ error: 'Hymn not found' });
    res.json(hymn);
  },

  create: async (req, res) => {
    const hymn = await HymnService.create(req.body);
    
    // Log the action if user is authenticated
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'CREATE',
        'HYMN',
        hymn.id,
        `Created hymn: ${hymn.title}`
      );
    }
    
    res.status(201).json(hymn);
  },

  update: async (req, res) => {
    const hymn = await HymnService.update(req.params.id, req.body);
    
    // Log the action if user is authenticated
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'UPDATE',
        'HYMN',
        hymn.id,
        `Updated hymn: ${hymn.title}`
      );
    }
    
    res.json(hymn);
  },

  delete: async (req, res) => {
    const { id } = req.params;
    const hymn = await HymnService.getById(id);
    
    await HymnService.delete(id);
    
    // Log the action if user is authenticated
    if (req.user) {
      await logService.createLog(
        req.user.id,
        'DELETE',
        'HYMN',
        id,
        `Deleted hymn: ${hymn?.title || id}`
      );
    }
    
    res.status(204).send();
  }
};