import pg from "pg";
import { config } from "../../config/index.js";

pg.types.setTypeParser(1082, (value) => value);

export const db = new pg.Pool({
  connectionString: config.database.url,
  ssl: { rejectUnauthorized: false },
  max: 10,
});
