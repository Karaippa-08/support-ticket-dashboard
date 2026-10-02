const path = require('path');
const express = require('express');
const { validateCreate, validateUpdate, PRIORITIES, STATUSES } = require('./validation');

const PAGE_SIZE = 10;

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const getById = db.prepare('SELECT * FROM tickets WHERE id = ?');

  // Summary counts always cover the whole dataset (no filters).
  app.get('/api/tickets/stats', (req, res) => {
    const rows = db.prepare('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status').all();
    const stats = { total: 0, open: 0, in_progress: 0, resolved: 0 };
    for (const { status, n } of rows) {
      stats.total += n;
      stats[status.toLowerCase().replace(' ', '_')] = n;
    }
    res.json(stats);
  });

  // List with search + filters + sort + pagination, all done in SQL.
  app.get('/api/tickets', (req, res) => {
    const { q = '', status = '', priority = '', sort = 'newest' } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    if (status && !STATUSES.includes(status)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid status filter.');
    if (priority && !PRIORITIES.includes(priority)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid priority filter.');
    if (!['newest', 'oldest'].includes(sort)) throw new ApiError(400, 'VALIDATION_ERROR', 'sort must be "newest" or "oldest".');

    const where = [];
    const params = [];
    if (String(q).trim()) {
      where.push("(title LIKE ? ESCAPE '\\' OR customer_email LIKE ? ESCAPE '\\')");
      const like = `%${escapeLike(String(q).trim())}%`;
      params.push(like, like);
    }
    if (status) { where.push('status = ?'); params.push(status); }
    if (priority) { where.push('priority = ?'); params.push(priority); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const dir = sort === 'oldest' ? 'ASC' : 'DESC';

    const total = db.prepare(`SELECT COUNT(*) AS n FROM tickets ${clause}`).get(...params).n;
    const items = db
      .prepare(`SELECT * FROM tickets ${clause} ORDER BY created_at ${dir}, id ${dir} LIMIT ? OFFSET ?`)
      .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);

    res.json({ items, page, pageSize: PAGE_SIZE, total, totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1) });
  });

  app.get('/api/tickets/:id', (req, res) => {
    const ticket = getById.get(req.params.id);
    if (!ticket) throw new ApiError(404, 'NOT_FOUND', 'Ticket not found.');
    res.json(ticket);
  });

  app.post('/api/tickets', (req, res) => {
    const { errors, value } = validateCreate(req.body);
    if (Object.keys(errors).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', errors);
    const info = db
      .prepare('INSERT INTO tickets (title, description, customer_email, priority, status) VALUES (@title, @description, @customer_email, @priority, @status)')
      .run(value);
    res.status(201).json(getById.get(info.lastInsertRowid));
  });

  app.patch('/api/tickets/:id', (req, res) => {
    const existing = getById.get(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Ticket not found.');
    const { errors, value } = validateUpdate(req.body);
    if (Object.keys(errors).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid update.', errors);
    const sets = Object.keys(value).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE tickets SET ${sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = @id`)
      .run({ ...value, id: existing.id });
    res.json(getById.get(existing.id));
  });

  app.use('/api', (req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')));

  // Consistent error shape: { error: { code, message, details? } }
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') err = new ApiError(400, 'BAD_JSON', 'Request body is not valid JSON.');
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({
      error: { code: err.code || 'INTERNAL_ERROR', message: status === 500 ? 'Something went wrong.' : err.message, details: err.details },
    });
  });

  return app;
}

module.exports = { createApp };
