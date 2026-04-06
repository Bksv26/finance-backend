/**
 * dashboardService.js
 *
 * Aggregation queries for the dashboard. Keeping these out of the controller
 * makes them easy to cache or swap out without touching routing logic.
 */

const { getDb } = require("../models/db");

function getSummary() {
  const row = getDb()
    .prepare(
      `SELECT
         ROUND(COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0), 2) AS total_income,
         ROUND(COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0), 2) AS total_expenses,
         COUNT(*) AS total_records
       FROM financial_records
       WHERE deleted = 0`
    )
    .get();

  row.net_balance = Math.round((row.total_income - row.total_expenses) * 100) / 100;
  return row;
}

function getByCategory() {
  return getDb()
    .prepare(
      `SELECT
         category,
         type,
         ROUND(SUM(amount), 2)  AS total,
         COUNT(*)               AS count
       FROM financial_records
       WHERE deleted = 0
       GROUP BY category, type
       ORDER BY total DESC`
    )
    .all();
}

function getMonthlyTrends(months = 12) {
  return getDb()
    .prepare(
      `SELECT
         strftime('%Y-%m', date)                                            AS month,
         ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 2)   AS income,
         ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2)   AS expenses,
         ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE -amount END), 2) AS net
       FROM financial_records
       WHERE deleted = 0
         AND date >= date('now', ? || ' months')
       GROUP BY month
       ORDER BY month ASC`
    )
    .all(`-${months}`);
}

function getWeeklyTrends(weeks = 8) {
  return getDb()
    .prepare(
      `SELECT
         strftime('%Y-W%W', date)                                          AS week,
         ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 2)  AS income,
         ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2)  AS expenses
       FROM financial_records
       WHERE deleted = 0
         AND date >= date('now', ? || ' days')
       GROUP BY week
       ORDER BY week ASC`
    )
    .all(`-${weeks * 7}`);
}

function getRecentActivity(limit = 10) {
  return getDb()
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
              u.name AS created_by_name
       FROM financial_records r
       JOIN users u ON u.id = r.created_by
       WHERE r.deleted = 0
       ORDER BY r.date DESC, r.id DESC
       LIMIT ?`
    )
    .all(limit);
}

module.exports = {
  getSummary,
  getByCategory,
  getMonthlyTrends,
  getWeeklyTrends,
  getRecentActivity,
};
