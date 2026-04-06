/**
 * Integration test suite
 * Run with: npm test
 */

process.env.NODE_ENV   = "test";
process.env.JWT_SECRET = "test_secret_do_not_use_in_prod";

const assert   = require("assert");
const Database = require("better-sqlite3");
const bcrypt   = require("bcryptjs");

// ── Build in-memory DB and patch BEFORE app loads ─────────────────────────────
const testDb = new Database(":memory:");
testDb.pragma("foreign_keys = ON");

testDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'viewer'
               CHECK(role IN ('viewer','analyst','admin')),
    status     TEXT    NOT NULL DEFAULT 'active'
               CHECK(status IN ('active','inactive')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS financial_records (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    amount     REAL    NOT NULL CHECK(amount > 0),
    type       TEXT    NOT NULL CHECK(type IN ('income','expense')),
    category   TEXT    NOT NULL,
    date       TEXT    NOT NULL,
    notes      TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    deleted    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

testDb.prepare(
  "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
).run("Test Admin", "admin@finance.local", bcrypt.hashSync("admin123", 10), "admin");

// Patch db module before app loads
const dbModule  = require("../models/db");
dbModule.getDb  = () => testDb;
dbModule.initDb = () => {};

// Now load app
const app    = require("../app");
const server = app.listen(3099);

// ── HTTP helper ───────────────────────────────────────────────────────────────
const http = require("http");
function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "127.0.0.1", port: 3099, path, method,
      headers: {
        "Content-Type": "application/json",
        ...(token   ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓  ${name}`); passed++; }
  catch (err) { console.error(`  ✗  ${name}\n     → ${err.message}`); failed++; }
}
function section(t) { console.log(`\n▸ ${t}`); }

let adminToken, analystToken, viewerToken;
let analystUserId, viewerUserId, recordId, recordId2;

async function runTests() {
  console.log("\n══════════════════════════════════════");
  console.log("  Finance Backend — Test Suite        ");
  console.log("══════════════════════════════════════\n");

  section("Health check");
  await test("GET /health returns 200 with timestamp", async () => {
    const res = await req("GET", "/health");
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.timestamp);
  });
  await test("unknown route returns 404", async () => {
    const res = await req("GET", "/api/does-not-exist");
    assert.strictEqual(res.status, 404);
  });

  section("Authentication");
  await test("valid admin login returns token", async () => {
    const res = await req("POST", "/api/auth/login", { email: "admin@finance.local", password: "admin123" });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    adminToken = res.body.token;
  });
  await test("wrong password returns 401", async () => {
    const res = await req("POST", "/api/auth/login", { email: "admin@finance.local", password: "wrongpassword" });
    assert.strictEqual(res.status, 401);
  });
  await test("unknown email returns 401", async () => {
    const res = await req("POST", "/api/auth/login", { email: "nobody@x.com", password: "pass123" });
    assert.strictEqual(res.status, 401);
  });
  await test("malformed email returns 400", async () => {
    const res = await req("POST", "/api/auth/login", { email: "not-an-email", password: "pass123" });
    assert.strictEqual(res.status, 400);
  });
  await test("self-registration creates viewer account", async () => {
    const res = await req("POST", "/api/auth/register", { name: "Dave Viewer", email: "dave@test.com", password: "dave1234" });
    assert.strictEqual(res.status, 201);
    viewerUserId = res.body.userId;
  });
  await test("duplicate email returns 409", async () => {
    const res = await req("POST", "/api/auth/register", { name: "Dave Again", email: "dave@test.com", password: "dave1234" });
    assert.strictEqual(res.status, 409);
  });
  await test("viewer can log in", async () => {
    const res = await req("POST", "/api/auth/login", { email: "dave@test.com", password: "dave1234" });
    assert.strictEqual(res.status, 200);
    viewerToken = res.body.token;
  });
  await test("no token returns 401", async () => {
    const res = await req("GET", "/api/records");
    assert.strictEqual(res.status, 401);
  });
  await test("bad token returns 401", async () => {
    const res = await req("GET", "/api/records", null, "bad.token.here");
    assert.strictEqual(res.status, 401);
  });

  section("User management");
  await test("admin creates analyst user", async () => {
    const res = await req("POST", "/api/users",
      { name: "Ana Analyst", email: "ana@test.com", password: "ana12345", role: "analyst" }, adminToken);
    assert.strictEqual(res.status, 201);
    analystUserId = res.body.userId;
  });
  await test("analyst can log in", async () => {
    const res = await req("POST", "/api/auth/login", { email: "ana@test.com", password: "ana12345" });
    assert.strictEqual(res.status, 200);
    analystToken = res.body.token;
  });
  await test("admin lists all users", async () => {
    const res = await req("GET", "/api/users", null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data) && res.body.data.length >= 3);
  });
  await test("viewer cannot list users (403)", async () => {
    const res = await req("GET", "/api/users", null, viewerToken);
    assert.strictEqual(res.status, 403);
  });
  await test("analyst cannot list users (403)", async () => {
    const res = await req("GET", "/api/users", null, analystToken);
    assert.strictEqual(res.status, 403);
  });
  await test("password never in user responses", async () => {
    const res = await req("GET", "/api/users", null, adminToken);
    assert.strictEqual(res.body.data.some(u => "password" in u), false);
  });
  await test("admin deactivates user", async () => {
    const res = await req("PATCH", `/api/users/${viewerUserId}`, { status: "inactive" }, adminToken);
    assert.strictEqual(res.status, 200);
  });
  await test("inactive user cannot log in (403)", async () => {
    const res = await req("POST", "/api/auth/login", { email: "dave@test.com", password: "dave1234" });
    assert.strictEqual(res.status, 403);
  });
  await test("admin cannot delete own account", async () => {
    const listRes = await req("GET", "/api/users", null, adminToken);
    const adminId = listRes.body.data.find(u => u.role === "admin").id;
    const res = await req("DELETE", `/api/users/${adminId}`, null, adminToken);
    assert.strictEqual(res.status, 400);
  });

  // reactivate viewer
  await req("PATCH", `/api/users/${viewerUserId}`, { status: "active" }, adminToken);
  const reLogin = await req("POST", "/api/auth/login", { email: "dave@test.com", password: "dave1234" });
  viewerToken = reLogin.body.token;

  section("Records — CRUD");
  await test("analyst creates income record", async () => {
    const res = await req("POST", "/api/records",
      { amount: 8500, type: "income", category: "Salary", date: "2025-03-01", notes: "March salary" }, analystToken);
    assert.strictEqual(res.status, 201);
    recordId = res.body.recordId;
  });
  await test("analyst creates expense record", async () => {
    const res = await req("POST", "/api/records",
      { amount: 1200, type: "expense", category: "Office Rent", date: "2025-03-05" }, analystToken);
    assert.strictEqual(res.status, 201);
    recordId2 = res.body.recordId;
  });
  await test("viewer can list records", async () => {
    const res = await req("GET", "/api/records", null, viewerToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data) && res.body.pagination);
  });
  await test("limit param restricts count", async () => {
    const res = await req("GET", "/api/records?limit=1", null, adminToken);
    assert.strictEqual(res.body.data.length, 1);
  });
  await test("viewer retrieves single record", async () => {
    const res = await req("GET", `/api/records/${recordId}`, null, viewerToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, recordId);
  });
  await test("non-existent record returns 404", async () => {
    const res = await req("GET", "/api/records/99999", null, adminToken);
    assert.strictEqual(res.status, 404);
  });
  await test("analyst updates record", async () => {
    const res = await req("PATCH", `/api/records/${recordId}`, { notes: "Q1 salary" }, analystToken);
    assert.strictEqual(res.status, 200);
    const check = await req("GET", `/api/records/${recordId}`, null, adminToken);
    assert.strictEqual(check.body.notes, "Q1 salary");
  });
  await test("viewer cannot create record (403)", async () => {
    const res = await req("POST", "/api/records",
      { amount: 50, type: "expense", category: "Food", date: "2025-03-10" }, viewerToken);
    assert.strictEqual(res.status, 403);
  });
  await test("viewer cannot update record (403)", async () => {
    const res = await req("PATCH", `/api/records/${recordId}`, { notes: "hacked" }, viewerToken);
    assert.strictEqual(res.status, 403);
  });
  await test("analyst cannot delete record (403)", async () => {
    const res = await req("DELETE", `/api/records/${recordId}`, null, analystToken);
    assert.strictEqual(res.status, 403);
  });
  await test("admin soft-deletes record", async () => {
    const res = await req("DELETE", `/api/records/${recordId2}`, null, adminToken);
    assert.strictEqual(res.status, 200);
  });
  await test("deleted record absent from list", async () => {
    const res = await req("GET", "/api/records", null, adminToken);
    assert.ok(!res.body.data.map(r => r.id).includes(recordId2));
  });
  await test("deleted record returns 404", async () => {
    const res = await req("GET", `/api/records/${recordId2}`, null, adminToken);
    assert.strictEqual(res.status, 404);
  });

  section("Records — filtering");
  await test("filter type=income returns only income", async () => {
    const res = await req("GET", "/api/records?type=income", null, analystToken);
    assert.ok(res.body.data.every(r => r.type === "income"));
  });
  await test("filter category partial match", async () => {
    const res = await req("GET", "/api/records?category=sal", null, analystToken);
    assert.ok(res.body.data.every(r => r.category.toLowerCase().includes("sal")));
  });
  await test("filter date_from excludes earlier records", async () => {
    const res = await req("GET", "/api/records?date_from=2025-03-01", null, analystToken);
    assert.ok(res.body.data.every(r => r.date >= "2025-03-01"));
  });

  section("Records — validation");
  await test("negative amount rejected", async () => {
    const res = await req("POST", "/api/records",
      { amount: -100, type: "income", category: "X", date: "2025-03-01" }, analystToken);
    assert.strictEqual(res.status, 400);
  });
  await test("zero amount rejected", async () => {
    const res = await req("POST", "/api/records",
      { amount: 0, type: "income", category: "X", date: "2025-03-01" }, analystToken);
    assert.strictEqual(res.status, 400);
  });
  await test("bad date format rejected with details", async () => {
    const res = await req("POST", "/api/records",
      { amount: 100, type: "expense", category: "Food", date: "March 1st" }, analystToken);
    assert.strictEqual(res.status, 400);
    assert.ok(Array.isArray(res.body.details));
  });
  await test("invalid type enum rejected", async () => {
    const res = await req("POST", "/api/records",
      { amount: 100, type: "transfer", category: "X", date: "2025-03-01" }, analystToken);
    assert.strictEqual(res.status, 400);
  });
  await test("missing fields returns details array", async () => {
    const res = await req("POST", "/api/records", { amount: 500 }, analystToken);
    assert.strictEqual(res.status, 400);
    assert.ok(Array.isArray(res.body.details) && res.body.details.length > 0);
  });

  section("Dashboard analytics");
  await test("summary has correct shape", async () => {
    const res = await req("GET", "/api/dashboard/summary", null, viewerToken);
    assert.strictEqual(res.status, 200);
    ["total_income","total_expenses","net_balance","total_records"].forEach(k =>
      assert.ok(k in res.body, `missing: ${k}`)
    );
  });
  await test("net_balance = income - expenses", async () => {
    const { total_income, total_expenses, net_balance } =
      (await req("GET", "/api/dashboard/summary", null, adminToken)).body;
    assert.strictEqual(net_balance, Math.round((total_income - total_expenses) * 100) / 100);
  });
  await test("by-category returns array", async () => {
    const res = await req("GET", "/api/dashboard/by-category", null, analystToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });
  await test("monthly-trends respects months param", async () => {
    const res = await req("GET", "/api/dashboard/monthly-trends?months=3", null, analystToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.months, 3);
  });
  await test("weekly-trends respects weeks param", async () => {
    const res = await req("GET", "/api/dashboard/weekly-trends?weeks=4", null, viewerToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.weeks, 4);
  });
  await test("recent activity newest-first", async () => {
    const res = await req("GET", "/api/dashboard/recent?limit=5", null, viewerToken);
    const dates = res.body.data.map(r => r.date);
    assert.deepStrictEqual(dates, [...dates].sort((a, b) => b.localeCompare(a)));
  });
  await test("dashboard rejects unauthenticated", async () => {
    const res = await req("GET", "/api/dashboard/summary");
    assert.strictEqual(res.status, 401);
  });

  const total = passed + failed;
  console.log("\n══════════════════════════════════════");
  console.log(`  ${passed}/${total} passed   (${failed} failed)`);
  console.log("══════════════════════════════════════\n");

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("\n[Fatal]", err.message);
  server.close();
  process.exit(1);
});