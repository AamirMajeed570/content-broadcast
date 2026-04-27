const { query } = require("../config/db");
const { ROLES } = require("../constants");
const { ApiError } = require("../utils/api-error");
const { comparePassword, hashPassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  created_at: user.created_at,
});

const registerUser = async ({ name, email, password, role }) => {
  const normalizedRole = String(role).toLowerCase();
  if (![ROLES.PRINCIPAL, ROLES.TEACHER].includes(normalizedRole)) {
    throw new ApiError(400, "Role must be either principal or teacher");
  }

  const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existingUser.rowCount > 0) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email.toLowerCase(), passwordHash, normalizedRole]
  );

  const user = result.rows[0];
  return {
    user,
    token: signToken({ id: user.id, email: user.email, role: user.role }),
  };
};

const loginUser = async ({ email, password }) => {
  const result = await query("SELECT * FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);

  if (result.rowCount === 0) {
    throw new ApiError(401, "Invalid email or password");
  }

  const user = result.rows[0];
  const isValidPassword = await comparePassword(password, user.password_hash);

  if (!isValidPassword) {
    throw new ApiError(401, "Invalid email or password");
  }

  return {
    user: sanitizeUser(user),
    token: signToken({ id: user.id, email: user.email, role: user.role }),
  };
};

module.exports = {
  registerUser,
  loginUser,
  sanitizeUser,
};

