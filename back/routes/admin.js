import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbHelpers } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "superSecret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

export function adminRoutesFactory({ db, rateLimiterStore }) {
  const router = express.Router();
  router.use(express.json());

  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const admin = await dbHelpers.get(db, "SELECT * FROM admin WHERE username = ?", [username]);
      if (!admin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const passwordValid = await bcrypt.compare(password, admin.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ sub: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.json({ token, expires: JWT_EXPIRES_IN });
    } catch (error) {
      console.error("/admin/login error", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  router.use(authMiddleware);

  router.get("/list", async (_req, res) => {
    try {
      const serials = await dbHelpers.all(db, "SELECT sn, status, note, updated_at FROM serials ORDER BY sn ASC");
      res.json(serials);
    } catch (error) {
      console.error("/admin/list error", error);
      res.status(500).json({ error: "Failed to list serials" });
    }
  });

  router.post("/add", async (req, res) => {
    try {
      const { sn, status, note } = req.body ?? {};
      const sanitizedSn = sanitizeSerial(sn);
      if (!sanitizedSn || !dbHelpers.serialStatuses.includes(status)) {
        return res.status(400).json({ error: "Serial and valid status required" });
      }
      await dbHelpers.run(
        db,
        `INSERT INTO serials (sn, status, note, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(sn) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = CURRENT_TIMESTAMP`,
        [sanitizedSn, status, note || null]
      );
      res.status(201).json({ message: "Serial saved" });
    } catch (error) {
      console.error("/admin/add error", error);
      res.status(500).json({ error: "Failed to save serial" });
    }
  });

  router.delete("/delete/:sn", async (req, res) => {
    try {
      const sn = sanitizeSerial(req.params.sn);
      const result = await dbHelpers.run(db, "DELETE FROM serials WHERE sn = ?", [sn]);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Serial not found" });
      }
      res.json({ message: "Serial deleted" });
    } catch (error) {
      console.error("/admin/delete error", error);
      res.status(500).json({ error: "Failed to delete serial" });
    }
  });

  router.post("/clear", async (_req, res) => {
    try {
      await dbHelpers.run(db, "DELETE FROM serials");
      res.json({ message: "All serials cleared" });
    } catch (error) {
      console.error("/admin/clear error", error);
      res.status(500).json({ error: "Failed to clear serials" });
    }
  });

  router.post("/reformat", async (_req, res) => {
    try {
      const rows = await dbHelpers.all(db, "SELECT sn, status, note FROM serials");
      let updated = 0;
      for (const row of rows) {
        const trimmedSn = sanitizeSerial(row.sn);
        const normalizedStatus = normalizeStatus(row.status);
        const trimmedNote = row.note?.trim() || null;
        if (trimmedSn !== row.sn || normalizedStatus !== row.status || trimmedNote !== row.note) {
          await dbHelpers.run(
            db,
            `UPDATE serials SET sn = ?, status = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE sn = ?`,
            [trimmedSn, normalizedStatus, trimmedNote, row.sn]
          );
          updated += 1;
        }
      }
      res.json({ message: "Database reformatted", updated });
    } catch (error) {
      console.error("/admin/reformat error", error);
      res.status(500).json({ error: "Failed to reformat database" });
    }
  });

  router.post("/reset-rate", async (_req, res) => {
    try {
      rateLimiterStore.resetAll();
      res.json({ message: "Rate limits reset" });
    } catch (error) {
      console.error("/admin/reset-rate error", error);
      res.status(500).json({ error: "Failed to reset rate limits" });
    }
  });

  return router;
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }
  const [, token] = authHeader.split(" ");
  if (!token) {
    return res.status(401).json({ error: "Invalid authorization header" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch (error) {
    console.error("JWT verification failed", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function sanitizeSerial(value = "") {
  return value.trim();
}

function normalizeStatus(value = "") {
  const normalized = value.trim().toLowerCase();
  return dbHelpers.serialStatuses.includes(normalized) ? normalized : "unknown";
}
