const { initSchema, pool } = require("../config/db");

initSchema()
  .then(() => {
    console.log("Database schema initialized successfully");
    return pool.end();
  })
  .catch((error) => {
    console.error("Failed to initialize schema", error);
    process.exit(1);
  });

