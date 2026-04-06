/**
 * seed.js — populate the database with realistic demo data
 *
 * Run with: npm run seed
 *
 * Safe to run multiple times — skips users that already exist and
 * only inserts records when the DB has fewer than 10 financial entries.
 */

require("dotenv").config();

const bcrypt   = require("bcryptjs");
const { getDb, initDb } = require("../models/db");

initDb();
const db = getDb();

// ── Users ──────────────────────────────────────────────────────────────────────

const users = [
  { name: "System Admin",   email: "admin@finance.local",   password: "admin123",   role: "admin"   },
  { name: "Priya Sharma",   email: "priya@finance.local",   password: "analyst123", role: "analyst" },
  { name: "Arjun Mehta",    email: "arjun@finance.local",   password: "analyst123", role: "analyst" },
  { name: "Deepa Nair",     email: "deepa@finance.local",   password: "viewer123",  role: "viewer"  },
  { name: "Rahul Verma",    email: "rahul@finance.local",   password: "viewer123",  role: "viewer"  },
];

const insertUser = db.prepare(
  "INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
);

console.log("\n[Seed] Creating users...");
for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  const info = insertUser.run(u.name, u.email, hash, u.role);
  if (info.changes > 0) {
    console.log(`  + ${u.role.padEnd(8)}  ${u.email}`);
  } else {
    console.log(`  ~ skipped  ${u.email} (already exists)`);
  }
}

// ── Financial Records ──────────────────────────────────────────────────────────

const existing = db
  .prepare("SELECT COUNT(*) AS cnt FROM financial_records WHERE deleted = 0")
  .get().cnt;

if (existing >= 10) {
  console.log(`\n[Seed] Skipping records — ${existing} already exist.\n`);
  process.exit(0);
}

const analysts = db
  .prepare("SELECT id FROM users WHERE role IN ('analyst','admin')")
  .all()
  .map((r) => r.id);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const records = [
  // Income
  { amount: 120000, type: "income",  category: "Salary",       date: dateOffset(1),   notes: "Monthly salary — April 2026" },
  { amount:  15000, type: "income",  category: "Consulting",   date: dateOffset(5),   notes: "Q1 advisory retainer" },
  { amount:   8500, type: "income",  category: "Freelance",    date: dateOffset(12),  notes: "Website project payment" },
  { amount:   3200, type: "income",  category: "Investments",  date: dateOffset(18),  notes: "Dividend payout" },
  { amount: 120000, type: "income",  category: "Salary",       date: dateOffset(31),  notes: "Monthly salary — March 2026" },
  { amount:  22000, type: "income",  category: "Consulting",   date: dateOffset(35),  notes: "Product review contract" },
  { amount:   5000, type: "income",  category: "Freelance",    date: dateOffset(44),  notes: "Logo design" },
  { amount: 120000, type: "income",  category: "Salary",       date: dateOffset(62),  notes: "Monthly salary — February 2026" },
  { amount:   9800, type: "income",  category: "Investments",  date: dateOffset(70),  notes: "Mutual fund redemption" },
  { amount:  18000, type: "income",  category: "Consulting",   date: dateOffset(75),  notes: "Strategy workshop" },
  { amount: 120000, type: "income",  category: "Salary",       date: dateOffset(92),  notes: "Monthly salary — January 2026" },
  { amount:   4500, type: "income",  category: "Freelance",    date: dateOffset(100), notes: "Content writing project" },
  // Expenses
  { amount:  35000, type: "expense", category: "Rent",         date: dateOffset(2),   notes: "Office rent — April" },
  { amount:   8200, type: "expense", category: "Payroll",      date: dateOffset(3),   notes: "Part-time contractor" },
  { amount:   1200, type: "expense", category: "Utilities",    date: dateOffset(4),   notes: "Electricity & internet" },
  { amount:   4500, type: "expense", category: "Marketing",    date: dateOffset(7),   notes: "Google Ads — April campaign" },
  { amount:    850, type: "expense", category: "Subscriptions",date: dateOffset(8),   notes: "SaaS tools" },
  { amount:   2300, type: "expense", category: "Travel",       date: dateOffset(10),  notes: "Client visit — Hyderabad to Mumbai" },
  { amount:   6700, type: "expense", category: "Equipment",    date: dateOffset(15),  notes: "Monitor and keyboard" },
  { amount:  35000, type: "expense", category: "Rent",         date: dateOffset(32),  notes: "Office rent — March" },
  { amount:   3800, type: "expense", category: "Marketing",    date: dateOffset(38),  notes: "LinkedIn ads" },
  { amount:    950, type: "expense", category: "Subscriptions",date: dateOffset(39),  notes: "Cloud hosting" },
  { amount:   1500, type: "expense", category: "Training",     date: dateOffset(42),  notes: "Online course licenses" },
  { amount:   2100, type: "expense", category: "Meals",        date: dateOffset(48),  notes: "Team lunch — Q1 review" },
  { amount:  35000, type: "expense", category: "Rent",         date: dateOffset(63),  notes: "Office rent — February" },
  { amount:   5500, type: "expense", category: "Marketing",    date: dateOffset(68),  notes: "Trade show booth" },
  { amount:   1100, type: "expense", category: "Utilities",    date: dateOffset(72),  notes: "Electricity & internet" },
  { amount:   3200, type: "expense", category: "Travel",       date: dateOffset(80),  notes: "Conference travel" },
  { amount:  35000, type: "expense", category: "Rent",         date: dateOffset(93),  notes: "Office rent — January" },
  { amount:   7800, type: "expense", category: "Equipment",    date: dateOffset(98),  notes: "Laptop for new hire" },
  { amount:    750, type: "expense", category: "Subscriptions",date: dateOffset(102), notes: "Annual software renewal" },
];

const insertRecord = db.prepare(
  `INSERT INTO financial_records (amount, type, category, date, notes, created_by)
   VALUES (?, ?, ?, ?, ?, ?)`
);

const seedRecords = db.transaction(() => {
  for (const r of records) {
    insertRecord.run(r.amount, r.type, r.category, r.date, r.notes, pick(analysts));
  }
});

console.log("\n[Seed] Inserting financial records...");
seedRecords();
console.log(`  + ${records.length} records inserted`);

const summary = db
  .prepare(
    `SELECT
       ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 2) AS income,
       ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2) AS expenses,
       COUNT(*) AS total
     FROM financial_records WHERE deleted = 0`
  )
  .get();

console.log(`\n[Seed] Done.`);
console.log(`  Records : ${summary.total}`);
console.log(`  Income  : ₹${summary.income.toLocaleString()}`);
console.log(`  Expenses: ₹${summary.expenses.toLocaleString()}`);
console.log(`  Net     : ₹${(summary.income - summary.expenses).toLocaleString()}\n`);
