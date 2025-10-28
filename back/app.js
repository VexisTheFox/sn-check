import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit, { MemoryStore } from "express-rate-limit";
import { publicRoutesFactory } from "./routes/public.js";
import { adminRoutesFactory } from "./routes/admin.js";
import { initDb } from "./db.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? "10", 10);
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW ?? `${60 * 60 * 1000}`, 10);

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));

const db = await initDb();

const rateLimiterStore = new MemoryStore();
const publicLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: `Rate limit exceeded (${RATE_LIMIT_MAX}/hour)` },
  store: rateLimiterStore
});

app.use("/api", publicRoutesFactory({ db, rateLimiter: publicLimiter }));
app.use("/api/admin", adminRoutesFactory({ db, rateLimiterStore }));

const server = app.listen(PORT, () => {
  console.log(`SerialCheck backend running on port ${PORT}`);
});

function shutdown() {
  console.log("Shutting down server...");
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
