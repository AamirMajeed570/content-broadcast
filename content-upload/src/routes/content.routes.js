const express = require("express");
const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");
const { ROLES } = require("../constants");
const { asyncHandler } = require("../utils/async-handler");
const { requireAuth, requireRole } = require("../middlewares/auth.middleware");
const { upload } = require("../middlewares/upload.middleware");
const {
  uploadContent,
  getMyContent,
  getPending,
  approve,
  reject,
  updateSchedule,
  getLiveContent,
} = require("../controllers/content.controller");

const router = express.Router();

const publicRateLimiter = rateLimit({
  windowMs: env.publicRateLimitWindowMs,
  max: env.publicRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/live/:teacherId", publicRateLimiter, asyncHandler(getLiveContent));
router.get("/", requireAuth, asyncHandler(getMyContent));
router.get(
  "/pending",
  requireAuth,
  requireRole(ROLES.PRINCIPAL),
  asyncHandler(getPending)
);
router.post(
  "/upload",
  requireAuth,
  requireRole(ROLES.TEACHER),
  upload.single("file"),
  asyncHandler(uploadContent)
);
router.patch(
  "/:id/schedule",
  requireAuth,
  requireRole(ROLES.TEACHER),
  asyncHandler(updateSchedule)
);
router.patch(
  "/:id/approve",
  requireAuth,
  requireRole(ROLES.PRINCIPAL),
  asyncHandler(approve)
);
router.patch(
  "/:id/reject",
  requireAuth,
  requireRole(ROLES.PRINCIPAL),
  asyncHandler(reject)
);

module.exports = router;

