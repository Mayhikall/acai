import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.env"
  ),
});

const directory = path.dirname(fileURLToPath(import.meta.url));
const connection = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl:
        process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    };

const shared = {
  client: "pg",
  connection,
  migrations: {
    directory: path.join(directory, "migrations"),
    extension: "js",
  },
  seeds: { directory: path.join(directory, "seeds"), extension: "js" },
};

const knexConfig = {
  development: { ...shared, pool: { min: 0, max: 10 } },
  test: { ...shared, pool: { min: 0, max: 4 } },
  production: {
    ...shared,
    connection:
      typeof connection === "string"
        ? { connectionString: connection, ssl: { rejectUnauthorized: true } }
        : connection,
    pool: { min: 2, max: 20 },
  },
};

export default knexConfig;
