const router = require("express").Router();
const ctrl = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/summary",        ctrl.getSummary);
router.get("/by-category",    ctrl.getByCategory);
router.get("/monthly-trends", ctrl.getMonthlyTrends);
router.get("/weekly-trends",  ctrl.getWeeklyTrends);
router.get("/recent",         ctrl.getRecentActivity);

module.exports = router;
