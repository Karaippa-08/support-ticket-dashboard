# Support Ticket Dashboard

A small full-stack app for a support team to create, search, triage and update tickets.

**Stack:** Node.js + Express (API) · SQLite via `better-sqlite3` (storage) · vanilla HTML/CSS/JS (frontend) · `node:test` (tests)

## Setup
Requires Node.js 18+.

```bash
npm install
npm run seed      # creates data/tickets.db with 32 sample tickets (use `-- --reset` to wipe & reseed)
npm start         # http://localhost:3000
npm test          # runs automated tests (in-memory DB, no setup needed)
```

### Environment variables (optional, see `.env.example`)
| Variable  | Default               | Purpose              |
|-----------|-----------------------|----------------------|
| `PORT`    | `3000`                | HTTP port            |
| `DB_FILE` | `./data/tickets.db`   | SQLite file location |

The schema is created automatically on first start (`src/db.js`), so no separate migration step is needed.

## API
| Method | Path | Description |
|---|---|---|
| GET | `/api/tickets?q=&status=&priority=&sort=newest\|oldest&page=1` | Search/filter/sort/paginate (10 per page) |
| GET | `/api/tickets/stats` | Total + per-status counts (whole dataset) |
| GET | `/api/tickets/:id` | Ticket detail |
| POST | `/api/tickets` | Create (title ≤120, description, valid email, priority, status default Open) |
| PATCH | `/api/tickets/:id` | Update `status` and/or `priority` |

Errors always look like `{ "error": { "code", "message", "details?" } }` with 400 (validation), 404 (not found) or 500.

## Project structure
```
src/db.js          schema + connection        src/validation.js  input rules (shared by routes)
src/app.js         routes + error handling    src/server.js      entry point
src/seed.js        sample data                public/            frontend (index.html, styles.css, app.js)
tests/             API tests
```

## Technical choices
- **SQLite** — zero setup, real SQL for filtering/sorting/pagination, easy for reviewers to run locally.
- **Vanilla JS frontend** — no build step; DOM is built with `textContent` so ticket content can't inject HTML.
- **Validation in one module** on the backend; the frontend mirrors the same rules for instant feedback, and also displays server-side field errors.
- **Parameterised queries everywhere**; `LIKE` wildcards in user search are escaped.

## Assumptions & limitations
- Only status and priority are editable after creation (per the brief).
- No authentication, deployment config, or comments/history (out of scope).
- Search is a simple `LIKE` match (fine for thousands of tickets; use FTS5 for more).
- Pagination is page-number based; no URL deep-linking of filters yet.
- Timestamps are stored as UTC ISO strings and displayed in the user's locale.

## Time spent
_Fill in your actual time (approx. 4–5 hours for this scope)._

## AI usage
_Describe how you used AI tools (e.g. scaffolding, test drafting) and be ready to explain every file._
