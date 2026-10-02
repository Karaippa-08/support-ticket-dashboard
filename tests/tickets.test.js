const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createDb } = require('../src/db');
const { createApp } = require('../src/app');

let server, base, db;
const api = async (path, opts = {}) => {
  const res = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) });
  return { status: res.status, body: await res.json() };
};
const make = (o = {}) => api('/api/tickets', { method: 'POST', body: { title: 'T', description: 'D', customer_email: 'a@b.com', priority: 'Low', ...o } });

before(async () => {
  db = createDb(':memory:');
  server = createApp(db).listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('validation rejects bad input with field-level errors', async () => {
  const { status, body } = await make({ title: 'x'.repeat(121), description: ' ', customer_email: 'nope', priority: 'Urgent' });
  assert.strictEqual(status, 400);
  assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  assert.deepStrictEqual(Object.keys(body.error.details).sort(), ['customer_email', 'description', 'priority', 'title']);
});

test('creates ticket with default status Open and timestamps', async () => {
  const { status, body } = await make({ title: 'Hello' });
  assert.strictEqual(status, 201);
  assert.strictEqual(body.status, 'Open');
  assert.ok(body.created_at && body.updated_at);
});

test('list combines search, filters, sort and paginates 10 per page', async () => {
  for (let i = 0; i < 14; i++) await make({ title: `Bulk ${i}`, customer_email: 'bulk@x.com', priority: 'High' });
  const p1 = await api('/api/tickets?q=bulk@x&priority=High&sort=oldest');
  assert.strictEqual(p1.body.items.length, 10);
  assert.strictEqual(p1.body.total, 14);
  assert.strictEqual(p1.body.totalPages, 2);
  assert.ok(p1.body.items[0].id < p1.body.items[9].id);
  const p2 = await api('/api/tickets?q=bulk@x&priority=High&page=2');
  assert.strictEqual(p2.body.items.length, 4);
  const none = await api('/api/tickets?q=bulk&priority=Low');
  assert.strictEqual(none.body.total, 0);
});

test('update persists status/priority and bumps updated_at; 404 for missing', async () => {
  const { body: t } = await make({ title: 'Update me' });
  await new Promise((r) => setTimeout(r, 15));
  const up = await api(`/api/tickets/${t.id}`, { method: 'PATCH', body: { status: 'Resolved', priority: 'High' } });
  assert.strictEqual(up.status, 200);
  const again = await api(`/api/tickets/${t.id}`);
  assert.strictEqual(again.body.status, 'Resolved');
  assert.strictEqual(again.body.priority, 'High');
  assert.notStrictEqual(again.body.updated_at, t.updated_at);
  assert.strictEqual((await api(`/api/tickets/${t.id}`, { method: 'PATCH', body: { status: 'Nope' } })).status, 400);
  assert.strictEqual((await api('/api/tickets/99999')).status, 404);
});

test('stats ignore filters and cover the whole dataset', async () => {
  const { body } = await api('/api/tickets/stats?status=Resolved');
  const all = await api('/api/tickets');
  assert.strictEqual(body.total, all.body.total);
  assert.strictEqual(body.open + body.in_progress + body.resolved, body.total);
});
