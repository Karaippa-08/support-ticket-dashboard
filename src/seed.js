const { createDb } = require('./db');

const db = createDb();
if (db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n > 0 && !process.argv.includes('--reset')) {
  console.log('Database already has tickets. Run "npm run seed -- --reset" to wipe and reseed.');
  process.exit(0);
}
db.exec("DELETE FROM tickets; DELETE FROM sqlite_sequence WHERE name='tickets';");

const subjects = [
  ['Cannot log in to my account', 'Password reset email never arrives and I am locked out.'],
  ['Invoice shows wrong amount', 'The March invoice is higher than our agreed plan.'],
  ['App crashes on startup', 'The mobile app closes immediately after the splash screen.'],
  ['Request: export to CSV', 'We would love a CSV export for the reports page.'],
  ['Slow dashboard loading', 'Dashboard takes over 30 seconds to load for our team.'],
  ['Update billing address', 'Please change our billing address to the new office.'],
  ['Two-factor codes not working', 'The authenticator codes are rejected every time.'],
  ['Duplicate charge on card', 'We were charged twice for this month subscription.'],
  ['Cannot upload attachments', 'Uploads over 5MB fail with a generic error.'],
  ['Feature question: API limits', 'What are the rate limits for the public API?'],
  ['Email notifications missing', 'We stopped receiving alert emails last week.'],
  ['Cancel my subscription', 'Please cancel the plan at the end of the billing period.'],
  ['Wrong language in UI', 'Interface switched to German after the last update.'],
  ['Data missing after sync', 'Several records disappeared after the nightly sync.'],
  ['SSO setup help', 'Need guidance configuring SAML with our identity provider.'],
];
const names = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi', 'ivan', 'judy'];
const domains = ['acme.com', 'globex.io', 'initech.co', 'umbrella.org'];
const priorities = ['Low', 'Medium', 'High'];
const statuses = ['Open', 'In Progress', 'Resolved'];

const insert = db.prepare('INSERT INTO tickets (title, description, customer_email, priority, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)');
const start = Date.now() - 40 * 24 * 3600 * 1000;
db.transaction(() => {
  for (let i = 0; i < 32; i++) {
    const [title, desc] = subjects[i % subjects.length];
    const created = new Date(start + i * 29 * 3600 * 1000).toISOString();
    const updated = new Date(Date.parse(created) + (i % 5) * 3600 * 1000).toISOString();
    insert.run(
      i >= subjects.length ? `${title} (follow-up)` : title, desc,
      `${names[i % names.length]}@${domains[i % domains.length]}`,
      priorities[(i * 7) % 3], statuses[(i * 5 + (i >> 2)) % 3], created, updated
    );
  }
})();
console.log(`Seeded ${db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n} tickets.`);
