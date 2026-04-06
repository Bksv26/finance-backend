const svc = require("../services/recordsService");

// GET /api/records
function listRecords(req, res) {
  const { page, limit, type, category, date_from, date_to } = req.query;
  const result = svc.findMany({ page, limit, type, category, date_from, date_to });

  return res.json({
    data: result.records,
    pagination: {
      page:  result.page,
      limit: result.limit,
      total: result.total,
      pages: result.pages,
    },
  });
}

// GET /api/records/:id
function getRecord(req, res) {
  const record = svc.findById(req.params.id);
  if (!record) return res.status(404).json({ error: "Record not found" });
  return res.json(record);
}

// POST /api/records
function createRecord(req, res) {
  const recordId = svc.create(req.body, req.user.id);
  return res.status(201).json({ message: "Record created", recordId });
}

// PATCH /api/records/:id
function updateRecord(req, res) {
  if (!svc.existsActive(req.params.id)) {
    return res.status(404).json({ error: "Record not found" });
  }
  svc.update(req.params.id, req.body);
  return res.json({ message: "Record updated" });
}

// DELETE /api/records/:id  (soft delete)
function deleteRecord(req, res) {
  if (!svc.existsActive(req.params.id)) {
    return res.status(404).json({ error: "Record not found" });
  }
  svc.softDelete(req.params.id);
  return res.json({ message: "Record deleted" });
}

module.exports = { listRecords, getRecord, createRecord, updateRecord, deleteRecord };
