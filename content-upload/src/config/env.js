const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 3000),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5433/content_broadcasting",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads"),
  maxFileSizeBytes: toNumber(process.env.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:3000",
  autoInitSchema: (process.env.AUTO_INIT_SCHEMA || "true") === "true",
  publicRateLimitWindowMs: toNumber(
    process.env.PUBLIC_RATE_LIMIT_WINDOW_MS,
    60_000
  ),
  publicRateLimitMax: toNumber(process.env.PUBLIC_RATE_LIMIT_MAX, 60),
  defaultRotationDurationMinutes: toNumber(
    process.env.DEFAULT_ROTATION_DURATION_MINUTES,
    5
  ),
};

module.exports = { env };

