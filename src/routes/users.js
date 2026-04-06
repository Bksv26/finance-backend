const router = require("express").Router();
const ctrl = require("../controllers/usersController");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { validate, createUserSchema, updateUserSchema } = require("../utils/validators");

// All user routes require authentication
router.use(authenticate);

router.get("/",       requireAdmin, ctrl.listUsers);
router.get("/:id",    requireAdmin, ctrl.getUser);
router.post("/",      requireAdmin, validate(createUserSchema), ctrl.createUser);
router.patch("/:id",               validate(updateUserSchema),  ctrl.updateUser);
router.delete("/:id", requireAdmin, ctrl.deleteUser);

module.exports = router;
