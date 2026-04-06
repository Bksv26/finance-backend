const router = require("express").Router();
const ctrl = require("../controllers/recordsController");
const { authenticate, requireAdmin, requireAnalyst } = require("../middleware/auth");
const {
  validate,
  createRecordSchema,
  updateRecordSchema,
  recordFilterSchema,
} = require("../utils/validators");

router.use(authenticate);

// READ — all roles
router.get("/",    validate(recordFilterSchema, "query"), ctrl.listRecords);
router.get("/:id", ctrl.getRecord);

// WRITE — analyst and above
router.post("/",    requireAnalyst, validate(createRecordSchema), ctrl.createRecord);
router.patch("/:id", requireAnalyst, validate(updateRecordSchema), ctrl.updateRecord);

// DELETE — admin only
router.delete("/:id", requireAdmin, ctrl.deleteRecord);

module.exports = router;
