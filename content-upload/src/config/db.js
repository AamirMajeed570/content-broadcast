const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { env } = require("./env");

const pool = new Pool({
  connectionString: env.databaseUrl,
});

const query = (text, params = []) => pool.query(text, params);

const withTransaction = async (callback) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

let schemaInitialized = false;

const initSchema = async () => {
  if (schemaInitialized) {
    return;
  }

  const schemaPath = path.resolve(__dirname, "../database/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schemaSql);
  schemaInitialized = true;
};

module.exports = {
  pool,
  query,
  withTransaction,
  initSchema,
};

