import express from "express";
import { dbHelpers } from "../db.js";

export function publicRoutesFactory({ db, rateLimiter }) {
  const router = express.Router();

  router.get("/check/:sn", rateLimiter, async (req, res) => {
    try {
      const sn = sanitizeSerial(req.params.sn);
      const record = await dbHelpers.get(db, "SELECT sn, status, note FROM serials WHERE sn = ?", [sn]);
      res.json({
        [sn]: record ? formatRecord(record) : { status: "unknown" }
      });
    } catch (error) {
      console.error("/check error", error);
      res.status(500).json({ error: "Failed to check serial" });
    }
  });

  router.post("/check-bulk", rateLimiter, async (req, res) => {
    try {
      const serials = Array.isArray(req.body?.serials) ? req.body.serials.map(sanitizeSerial).slice(0, 10) : [];
      if (serials.length === 0) {
        return res.status(400).json({ error: "Provide up to 10 serials" });
      }
      const placeholders = serials.map(() => "?").join(",");
      const rows = await dbHelpers.all(db, `SELECT sn, status, note FROM serials WHERE sn IN (${placeholders})`, serials);
      const result = Object.fromEntries(serials.map((sn) => [sn, { status: "unknown" }]));
      for (const row of rows) {
        result[row.sn] = formatRecord(row);
      }
      res.json(result);
    } catch (error) {
      console.error("/check-bulk error", error);
      res.status(500).json({ error: "Failed to perform bulk check" });
    }
  });

  return router;
}

function sanitizeSerial(value = "") {
  return value.trim();
}

function formatRecord(record) {
  return {
    status: record.status,
    ...(record.note ? { note: record.note } : {})
  };
}
