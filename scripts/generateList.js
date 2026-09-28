import { db } from "../src/core/db/pool.js";
import fs from "fs";

async function main() {
  try {
    const res = await db.query(`
      SELECT id, name, details->>'citizenshipStatus' as cs, details->>'singpass' as sp
      FROM public.ca_employees
      WHERE establishment_id = 2
      ORDER BY id
    `);
    
    let lines = ["Singapore HQ Employees Citizenship Details:\n"];
    for (const r of res.rows) {
      lines.push(`- ID: ${r.id}, Name: ${r.name}, Status: ${r.cs}${r.sp ? ', Singpass: ' + r.sp : ''}`);
    }
    
    fs.writeFileSync("sg_employees_status.txt", lines.join("\n"));
    console.log("List generated.");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
