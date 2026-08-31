import pg from "pg";
import { config } from "../../config/index.js";

export const db = new pg.Pool({
  connectionString: config.database.url,
  ssl: { rejectUnauthorized: false },
  max: 10,
});
