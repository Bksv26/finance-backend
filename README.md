# Finance Data Processing and Access Control Backend

A clean, production-minded REST API backend for a multi-role finance dashboard. Built with **Node.js**, **Express**, and **SQLite** — zero-setup, fully runnable, and thoroughly tested.

---

## Quick Start

```bash
git clone <repo-url>
cd finance-backend

npm install

cp .env.example .env          # configure environment
npm start                     # http://localhost:3000

npm run seed                  # (optional) load 30 realistic records + demo users
npm test                      # run the full integration test suite
```

On first start a default admin account is seeded automatically:

| Email | Password | Role |
|---|---|---|
| `admin@finance.local` | `admin123` | Admin |

After running `npm run seed`, additional demo accounts are available:

| Email | Password | Role |
|---|---|---|
| `priya@finance.local` | `analyst123` | Analyst |
| `arjun@finance.local` | `analyst123` | Analyst |
| `deepa@finance.local` | `viewer123` | Viewer |
| `rahul@finance.local` | `viewer123` | Viewer |

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 18+ | Ubiquitous, fast async I/O |
| Framework | Express 4 | Minimal, battle-tested, flexible |
| Database | SQLite (better-sqlite3) | Zero setup; synchronous driver simplifies code; standard SQL throughout |
| Auth | JWT (jsonwebtoken) | Stateless, standard, no session store needed |
| Passwords | bcryptjs | Industry-standard hashing with configurable cost |
| Validation | Zod | Type-safe schemas; field-level errors out of the box |
| Security | helmet + cors | Security headers and origin control |
| Logging | morgan | Structured request logging in development |
| Rate limiting | express-rate-limit | Brute-force and abuse protection |
| Config | dotenv | Twelve-factor app environment management |

---

## Project Structure

```
finance-backend/
├── .env.example                  # environment variable template
├── .gitignore
├── package.json
├── README.md
└── src/
    ├── app.js                    # Express app: middleware, routes, error handling
    ├── models/
    │   └── db.js                 # SQLite connection, schema init, default admin seed
    ├── services/
    │   ├── recordsService.js     # All DB logic for financial_records
    │   └── dashboardService.js   # All aggregation queries for the dashboard
    ├── controllers/
    │   ├── authController.js     # Login, register
    │   ├── usersController.js    # User CRUD + role/status management
    │   ├── recordsController.js  # Thin: delegates to recordsService
    │   └── dashboardController.js# Thin: delegates to dashboardService
    ├── middleware/
    │   └── auth.js               # JWT verification + requireRole() guard factory
    ├── routes/
    │   ├── auth.js
    │   ├── users.js
    │   ├── records.js
    │   └── dashboard.js
    ├── utils/
    │   └── validators.js         # Zod schemas + validate() middleware factory
    ├── seeds/
    │   └── seed.js               # Realistic demo data (30 records, 5 users)
    └── tests/
        └── run.js                # 40+ integration tests, no external runner
```

### Architectural layers

```
Request → Route → Middleware (auth, validate) → Controller → Service → DB
```

Controllers are intentionally thin — they handle HTTP concerns (status codes, response shape) and delegate all business and data logic to the service layer. This separation makes the services independently testable and the controllers easy to read at a glance.

---

## Roles & Permissions

Roles follow a numeric hierarchy (`viewer=1, analyst=2, admin=3`). A higher-level role automatically passes all lower-level guards.

| Action | Viewer | Analyst | Admin |
|---|:---:|:---:|:---:|
| Login / register | ✓ | ✓ | ✓ |
| View financial records | ✓ | ✓ | ✓ |
| View all dashboard analytics | ✓ | ✓ | ✓ |
| Create financial records | ✗ | ✓ | ✓ |
| Update financial records | ✗ | ✓ | ✓ |
| Soft-delete financial records | ✗ | ✗ | ✓ |
| List / view users | ✗ | ✗ | ✓ |
| Create users (any role) | ✗ | ✗ | ✓ |
| Change user role / status | ✗ | ✗ | ✓ |
| Delete users | ✗ | ✗ | ✓ |

---

## API Reference

All protected endpoints require:
```
Authorization: Bearer <token>
```

---

### Auth

#### `POST /api/auth/login`

```json
{ "email": "admin@finance.local", "password": "admin123" }
```

**200 response:**
```json
{
  "token": "eyJ...",
  "user": { "id": 1, "name": "System Admin", "email": "admin@finance.local", "role": "admin" }
}
```

#### `POST /api/auth/register`

Open endpoint. Always creates a `viewer` account.

```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123" }
```

---

### Users *(Admin only)*

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | List all users |
| `GET` | `/api/users/:id` | Get a single user |
| `POST` | `/api/users` | Create user (any role) |
| `PATCH` | `/api/users/:id` | Update name / role / status |
| `DELETE` | `/api/users/:id` | Hard-delete user |

**Create body:**
```json
{ "name": "Alice", "email": "alice@example.com", "password": "pass123", "role": "analyst" }
```

**Update body** *(all fields optional)*:
```json
{ "name": "Alice Smith", "role": "admin", "status": "inactive" }
```

---

### Financial Records

| Method | Path | Role required | Description |
|---|---|---|---|
| `GET` | `/api/records` | Any | List records — paginated, filterable |
| `GET` | `/api/records/:id` | Any | Get a single record |
| `POST` | `/api/records` | Analyst+ | Create record |
| `PATCH` | `/api/records/:id` | Analyst+ | Partial update |
| `DELETE` | `/api/records/:id` | Admin | Soft-delete |

**Create / update body:**
```json
{
  "amount": 1500.00,
  "type": "expense",
  "category": "Marketing",
  "date": "2026-04-01",
  "notes": "Q2 campaign spend"
}
```

**Query filters for `GET /api/records`:**

| Param | Type | Description |
|---|---|---|
| `type` | `income` \| `expense` | Exact match |
| `category` | string | Partial (case-insensitive) match |
| `date_from` | `YYYY-MM-DD` | Inclusive lower bound |
| `date_to` | `YYYY-MM-DD` | Inclusive upper bound |
| `page` | integer ≥ 1 | Default `1` |
| `limit` | integer 1–100 | Default `20` |

**Example:**
```
GET /api/records?type=expense&category=rent&date_from=2026-01-01&page=1&limit=10
```

**List response:**
```json
{
  "data": [ { "id": 1, "amount": 35000, "type": "expense", "category": "Rent", ... } ],
  "pagination": { "page": 1, "limit": 10, "total": 4, "pages": 1 }
}
```

---

### Dashboard *(Any authenticated user)*

| Method | Path | Query params | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | — | Totals and net balance |
| `GET` | `/api/dashboard/by-category` | — | Grouped by category + type |
| `GET` | `/api/dashboard/monthly-trends` | `months` (default 12, max 60) | Monthly income / expenses / net |
| `GET` | `/api/dashboard/weekly-trends` | `weeks` (default 8, max 52) | Weekly income / expenses |
| `GET` | `/api/dashboard/recent` | `limit` (default 10, max 50) | Latest N records |

**Summary response:**
```json
{
  "total_income": 446500.00,
  "total_expenses": 188750.00,
  "net_balance": 257750.00,
  "total_records": 30
}
```

**Monthly trends response:**
```json
{
  "data": [
    { "month": "2026-01", "income": 124500.00, "expenses": 43550.00, "net": 80950.00 },
    { "month": "2026-02", "income": 129800.00, "expenses": 41600.00, "net": 88200.00 }
  ],
  "months": 12
}
```

---

### Health

```
GET /health
→ { "status": "ok", "timestamp": "2026-04-05T12:00:00.000Z" }
```

---

## Data Model

### `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL, UNIQUE |
| `password` | TEXT | bcrypt hash, never returned in responses |
| `role` | TEXT | `viewer` \| `analyst` \| `admin` — CHECK constraint |
| `status` | TEXT | `active` \| `inactive` — CHECK constraint |
| `created_at` | TEXT | ISO datetime, set on insert |
| `updated_at` | TEXT | ISO datetime, updated on every PATCH |

### `financial_records`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `amount` | REAL | NOT NULL, CHECK > 0 |
| `type` | TEXT | `income` \| `expense` — CHECK constraint |
| `category` | TEXT | NOT NULL |
| `date` | TEXT | NOT NULL, format `YYYY-MM-DD` |
| `notes` | TEXT | Nullable |
| `created_by` | INTEGER FK | References `users(id)` |
| `deleted` | INTEGER | `0` active, `1` soft-deleted — default 0 |
| `created_at` | TEXT | ISO datetime |
| `updated_at` | TEXT | ISO datetime |

Indexes on `date`, `type`, `category`, `deleted` for efficient filtered queries.

---

## Error Responses

All errors share a consistent shape:

```json
{ "error": "Human-readable message" }
```

Validation errors include field-level detail:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "date",   "message": "Date must be YYYY-MM-DD" },
    { "field": "amount", "message": "Number must be greater than 0" }
  ]
}
```

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request / validation error |
| `401` | Missing, malformed, or expired token |
| `403` | Insufficient role or inactive account |
| `404` | Resource not found |
| `409` | Conflict (e.g. email already registered) |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |

---

## Environment Variables

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | `finance_dev_secret_change_in_prod` | Token signing key — **change this** |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime (e.g. `1d`, `30m`) |
| `DB_PATH` | `./finance.db` | Path to the SQLite database file |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW_MINUTES` | `15` | Rate limit window size |
| `CORS_ORIGINS` | *(empty = allow all)* | Comma-separated allowed origins |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |

---

## Running Tests

```bash
npm test
```

The test suite spins up the app on port 3099 against an isolated **in-memory SQLite database** (never touches your `finance.db`). No Jest, Mocha, or any other test runner is required.

**Coverage:**
- Health check and 404 handling
- Auth: valid login, wrong password, unknown email, invalid input, duplicate registration, inactive account block
- Users: CRUD, role assignment, deactivation / reactivation, self-delete protection, password never exposed
- Records: create, read, update, list with pagination, filter by type / category / date range, validation rejection
- Soft delete: deleted records hidden from list and single-fetch, double-delete returns 404
- Dashboard: summary math, by-category grouping, monthly and weekly trends, recent activity
- Access control: viewer / analyst / admin boundaries enforced on every route, malformed tokens rejected

---

## Assumptions & Design Decisions

1. **SQLite over Postgres/MySQL** — chosen for zero-setup simplicity appropriate for an internship assessment. The DB module is the only place that references SQLite; swapping to `pg` or `mysql2` requires changing only `src/models/db.js`.

2. **Services layer** — all database queries live in `src/services/`, not in controllers. Controllers only handle HTTP input/output. This keeps business logic testable without booting the HTTP server.

3. **Analysts can write, only admins can delete** — the brief leaves analyst write access ambiguous. Interpreted as: analysts are data-entry operators who create and correct records, while deletion (even soft) is an administrative action requiring explicit privilege.

4. **Open registration creates viewers** — self-registered accounts always get `viewer` role. Only an admin can create accounts with elevated roles via `POST /api/users`. This prevents privilege escalation through open registration.

5. **Soft delete on records, hard delete on users** — financial records have an implicit audit-trail expectation (regulatory assumption). User deletion has no such constraint in this scope.

6. **Passwords are never returned** — enforced by explicitly selecting only safe columns (`id, name, email, role, status, ...`) rather than a post-filter. There is no path in the codebase where the `password` column appears in a response.

7. **No refresh tokens** — kept out of scope. The configurable `JWT_EXPIRES_IN` (default 8 hours) is appropriate for an internal dashboard where users are expected to re-authenticate daily.

8. **WAL mode + foreign keys** — SQLite is run with `PRAGMA journal_mode = WAL` (better concurrent reads) and `PRAGMA foreign_keys = ON` (enforce referential integrity). These are set at connection time in `db.js`.
