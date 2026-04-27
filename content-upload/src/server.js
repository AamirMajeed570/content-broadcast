const fs = require("fs");
const { app } = require("./app");
const { env } = require("./config/env");
const { initSchema, pool } = require("./config/db");

const startServer = async () => {
  fs.mkdirSync(env.uploadDir, { recursive: true });

  if (env.autoInitSchema) {
    await initSchema();
  }

  const server = app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

