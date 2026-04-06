const bcrypt = require("bcryptjs");
const { getDb } = require("../models/db");

const SAFE_COLS = "id, name, email, role, status, created_at, updated_at";

// GET /api/users
function listUsers(req, res) {
  const users = getDb().prepare(`SELECT ${SAFE_COLS} FROM users`).all();
  return res.json({ data: users, total: users.length });
}

// GET /api/users/:id
function getUser(req, res) {
  const user = getDb()
    .prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`)
    .get(req.params.id);

  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
}

// POST /api/users  (admin only — can set any role)
function createUser(req, res) {
  const { name, email, password, role } = req.body;
  const db = getDb();

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
    )
    .run(name, email, hash, role);

  return res.status(201).json({
    message: "User created",
    userId: result.lastInsertRowid,
  });
}

// PATCH /api/users/:id
function updateUser(req, res) {
  const db = getDb();
  const user = db
    .prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`)
    .get(req.params.id);

  if (!user) return res.status(404).json({ error: "User not found" });

  // Non-admins can only update themselves and cannot change their own role
  if (req.user.role !== "admin") {
    if (req.user.id !== user.id) {
      return res.status(403).json({ error: "You can only update your own profile" });
    }
    if (req.body.role || req.body.status) {
      return res.status(403).json({ error: "Cannot change role or status" });
    }
  }

  const { name, role, status } = req.body;
  db.prepare(
    `UPDATE users
     SET name = COALESCE(?, name),
         role = COALESCE(?, role),
         status = COALESCE(?, status),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(name ?? null, role ?? null, status ?? null, req.params.id);

  return res.json({ message: "User updated" });
}

// DELETE /api/users/:id  (admin only)
function deleteUser(req, res) {
  const db = getDb();

  // Prevent admin from deleting themselves
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  const result = db
    .prepare("DELETE FROM users WHERE id = ?")
    .run(req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: "User not found" });
  return res.json({ message: "User deleted" });
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
