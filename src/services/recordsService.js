/**
 * recordsService.js
 *
 * All database interactions for financial_records live here.
 * Controllers call these functions — they never touch getDb() directly.
 * This makes the logic easily testable and keeps controllers thin.
 */

const { getDb } = require("../models/db");

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildWhereClause(filters) {
  const conditions = ["r.deleted = 0"];
  const params = [];

  if (filters.type) {
    conditions.push("r.type = ?");
    params.push(filters.type);
  }
  if (filters.category) {
    conditions.push("r.category LIKE ?");
    params.push(`%${filters.category}%`);
  }
  if (filters.date_from) {
    conditions.push("r.date >= ?");
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push("r.date <= ?");
    params.push(filters.date_to);
  }

  return { where: conditions.join(" AND "), params };
}

// ── Service functions ──────────────────────────────────────────────────────────

function findMany({ page = 1, limit = 20, ...filters }) {
  const db = getDb();
  const { where, params } = buildWhereClause(filters);
  const offset = (page - 1) * limit;

  const total = db
    .prepare(`SELECT COUNT(*) AS cnt FROM financial_records r WHERE ${where}`)
    .get(...params).cnt;

  const records = db
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
              r.created_by, r.created_at, r.updated_at,
              u.name AS created_by_name
       FROM financial_records r
       JOIN users u ON u.id = r.created_by
       WHERE ${where}
       ORDER BY r.date DESC, r.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { records, total, page, limit, pages: Math.ceil(total / limit) };
}

function findById(id) {
  return getDb()
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
              r.created_by, r.created_at, r.updated_at,
              u.name AS created_by_name
       FROM financial_records r
       JOIN users u ON u.id = r.created_by
       WHERE r.id = ? AND r.deleted = 0`
    )
    .get(id);
}

function create({ amount, type, category, date, notes }, userId) {
  const result = getDb()
    .prepare(
      `INSERT INTO financial_records (amount, type, category, date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(amount, type, category, date, notes ?? null, userId);

  return result.lastInsertRowid;
}

function update(id, fields) {
  const { amount, type, category, date, notes } = fields;
  getDb()
    .prepare(
      `UPDATE financial_records
       SET amount     = COALESCE(?, amount),
           type       = COALESCE(?, type),
           category   = COALESCE(?, category),
           date       = COALESCE(?, date),
           notes      = COALESCE(?, notes),
           updated_at = datetime('now')
       WHERE id = ? AND deleted = 0`
    )
    .run(
      amount   ?? null,
      type     ?? null,
      category ?? null,
      date     ?? null,
      notes    ?? null,
      id
    );
}

function softDelete(id) {
  getDb()
    .prepare(
      "UPDATE financial_records SET deleted = 1, updated_at = datetime('now') WHERE id = ?"
    )
    .run(id);
}

function existsActive(id) {
  return !!getDb()
    .prepare("SELECT id FROM financial_records WHERE id = ? AND deleted = 0")
    .get(id);
}

module.exports = { findMany, findById, create, update, softDelete, existsActive };
