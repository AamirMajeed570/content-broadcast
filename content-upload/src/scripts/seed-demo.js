const { initSchema, query, pool } = require("../config/db");
const { hashPassword } = require("../utils/password");

const users = [
  {
    name: "Demo Principal",
    email: "principal@example.com",
    password: "Password123",
    role: "principal",
  },
  {
    name: "Demo Teacher",
    email: "teacher@example.com",
    password: "Password123",
    role: "teacher",
  },
];

const seed = async () => {
  await initSchema();

  for (const user of users) {
    const existing = await query("SELECT id FROM users WHERE email = $1", [user.email]);
    if (existing.rowCount > 0) {
      continue;
    }

    const passwordHash = await hashPassword(user.password);
    await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
      [user.name, user.email, passwordHash, user.role]
    );
  }
};

seed()
  .then(async () => {
    console.log("Demo users seeded successfully");
    await pool.end();
  })
  .catch((error) => {
    console.error("Failed to seed demo users", error);
    process.exit(1);
  });

