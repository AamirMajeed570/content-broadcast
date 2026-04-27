const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const { requireAuth } = require("../middlewares/auth.middleware");
const { register, login, me } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));

module.exports = router;

