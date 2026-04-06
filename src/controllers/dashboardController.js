const svc = require("../services/dashboardService");

// GET /api/dashboard/summary
function getSummary(_req, res) {
  return res.json(svc.getSummary());
}

// GET /api/dashboard/by-category
function getByCategory(_req, res) {
  return res.json({ data: svc.getByCategory() });
}

// GET /api/dashboard/monthly-trends?months=12
function getMonthlyTrends(req, res) {
  const months = Math.min(Math.max(parseInt(req.query.months) || 12, 1), 60);
  return res.json({ data: svc.getMonthlyTrends(months), months });
}

// GET /api/dashboard/weekly-trends?weeks=8
function getWeeklyTrends(req, res) {
  const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 8, 1), 52);
  return res.json({ data: svc.getWeeklyTrends(weeks), weeks });
}

// GET /api/dashboard/recent?limit=10
function getRecentActivity(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
  return res.json({ data: svc.getRecentActivity(limit) });
}

module.exports = {
  getSummary,
  getByCategory,
  getMonthlyTrends,
  getWeeklyTrends,
  getRecentActivity,
};
