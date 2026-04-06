const { z } = require("zod");

// ── Auth ────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

// ── Users ───────────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().email(),
  password: z.string().min(6),
  role:     z.enum(["viewer", "analyst", "admin"]).default("viewer"),
});

const updateUserSchema = z.object({
  name:   z.string().min(1).max(100).optional(),
  role:   z.enum(["viewer", "analyst", "admin"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

// ── Financial Records ───────────────────────────────────────────────────────
const createRecordSchema = z.object({
  amount:   z.number().positive(),
  type:     z.enum(["income", "expense"]),
  category: z.string().min(1).max(100),
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  notes:    z.string().max(500).optional(),
});

const updateRecordSchema = createRecordSchema.partial();

const recordFilterSchema = z.object({
  type:       z.enum(["income", "expense"]).optional(),
  category:   z.string().optional(),
  date_from:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
});

// ── Validator middleware factory ─────────────────────────────────────────────
function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }
    req[source] = result.data;   // replace with coerced/defaulted values
    next();
  };
}

module.exports = {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  createRecordSchema,
  updateRecordSchema,
  recordFilterSchema,
  validate,
};
