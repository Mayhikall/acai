import knex from "knex";
import configurations from "./knexfile.js";

export const db = knex(configurations[process.env.NODE_ENV || "development"]);

export async function closeDatabase() {
  await db.destroy();
}
