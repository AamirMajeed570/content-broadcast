const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
  role: z.string().trim().toLowerCase(),
});

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
});

module.exports = {
  registerSchema,
  loginSchema,
};

