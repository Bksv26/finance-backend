require("dotenv").config();

const express   = require("express");
const helmet    = require("helmet");
const cors      = require("cors");
const morgan    = require("morgan");
const rateLimit = require("express-rate-limit");

const { initDb } = require("./models/db");

// ── Initialise DB ──────────────────────────────────────────────────────────────
initDb();

const app = express();

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────────
const rawOrigins = process.env.CORS_ORIGINS;
const allowedOrigins = rawOrigins
  ? rawOrigins.split(",").map((o) => o.trim())
  : "*";

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Request logging ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json());

// ── Rate limiting ──────────────────────────────────────────────────────────────
const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15;
const maxRequests   = parseInt(process.env.RATE_LIMIT_MAX)            || 100;

app.use(
  rateLimit({
    windowMs:        windowMinutes * 60 * 1000,
    max:             maxRequests,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { error: "Too many requests — please slow down" },
    skip:            () => process.env.NODE_ENV === "test",
  })
);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api/auth",      require("./routes/auth"));
app.use("/api/users",     require("./routes/users"));
app.use("/api/records",   require("./routes/records"));
app.use("/api/dashboard", require("./routes/dashboard"));

// Health check — useful for deployment readiness probes
app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[Error]", err.message);
  if (process.env.NODE_ENV === "development") {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
  res.status(500).json({ error: "Internal server error" });
});

// ── Start (skipped when required by tests) ─────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(
      `[Server] Running on http://localhost:${PORT}  [${process.env.NODE_ENV || "development"}]`
    );
  });
}

module.exports = app;
