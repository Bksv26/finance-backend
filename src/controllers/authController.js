const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("../models/db");
const { JWT_SECRET } = require("../middleware/auth");

// POST /api/auth/login
function login(req, res) {
  const { email, password } = req.body;

  const user = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (user.status !== "active") {
    return res.status(403).json({ error: "Account is inactive" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

// POST /api/auth/register  (open endpoint — creates viewer by default)
function register(req, res) {
  const { name, email, password } = req.body;
  const db = getDb();

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'viewer')"
    )
    .run(name, email, hash);

  return res.status(201).json({
    message: "Account created",
    userId: result.lastInsertRowid,
  });
}

module.exports = { login, register };
