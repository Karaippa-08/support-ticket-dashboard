const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

function createDb(file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'tickets.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL CHECK(length(title) <= 120),
      description TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('Low','Medium','High')),
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Resolved')),
      created_at TEXT NOT NULL DEFAULT (${NOW}),
      updated_at TEXT NOT NULL DEFAULT (${NOW})
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);
  `);
  return db;
}

module.exports = { createDb };
