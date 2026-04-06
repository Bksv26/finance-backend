require("dotenv").config();
const jwt = require("jsonwebtoken");
const { getDb } = require("../models/db");

const JWT_SECRET = process.env.JWT_SECRET || "finance_dev_secret_change_in_prod";

// ── Attach user to request ─────────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getDb()
      .prepare("SELECT id, name, email, role, status FROM users WHERE id = ?")
      .get(payload.userId);

    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.status !== "active")
      return res.status(403).json({ error: "Account is inactive" });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Role hierarchy ─────────────────────────────────────────────────────────
const ROLE_LEVEL = { viewer: 1, analyst: 2, admin: 3 };

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const allowed = roles.some(
      (r) => ROLE_LEVEL[req.user.role] >= ROLE_LEVEL[r]
    );
    if (!allowed) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }
    next();
  };
}

// Convenience guards
const requireAdmin   = requireRole("admin");
const requireAnalyst = requireRole("analyst");
const requireViewer  = requireRole("viewer");   // any authenticated user

module.exports = { authenticate, requireRole, requireAdmin, requireAnalyst, requireViewer, JWT_SECRET };
