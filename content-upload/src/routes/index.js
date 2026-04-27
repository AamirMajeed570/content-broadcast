const express = require("express");
const authRoutes = require("./auth.routes");
const contentRoutes = require("./content.routes");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Service is healthy",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/content", contentRoutes);

module.exports = router;

