const router = require("express").Router();
const { login, register } = require("../controllers/authController");
const { validate, loginSchema, createUserSchema } = require("../utils/validators");

router.post("/login",    validate(loginSchema),       login);
router.post("/register", validate(createUserSchema),  register);

module.exports = router;
