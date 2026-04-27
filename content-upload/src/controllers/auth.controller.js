const { registerSchema, loginSchema } = require("../validators/auth.validator");
const { ApiError } = require("../utils/api-error");
const { registerUser, loginUser } = require("../services/auth.service");

const register = async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid registration payload", parsed.error.flatten());
  }

  const result = await registerUser(parsed.data);
  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: result,
  });
};

const login = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid login payload", parsed.error.flatten());
  }

  const result = await loginUser(parsed.data);
  res.status(200).json({
    success: true,
    message: "Login successful",
    data: result,
  });
};

const me = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

module.exports = {
  register,
  login,
  me,
};

