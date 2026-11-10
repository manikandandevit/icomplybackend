/**
 * Moves base64 employee documents (ca_employees.details.documents[].url = "data:...")
 * to S3 and keeps only the public URL + key in the database.
 *
 * Dry run (default, changes nothing):
 *   node scripts/migrate_employee_documents.js
 *
 * Apply changes (take a DB backup first):
 *   node scripts/migrate_employee_documents.js --apply
 */
import { db } from "../src/core/db/pool.js";
import {
  isBase64Document,
  isStorageConfigured,
  uploadBase64Document,
} from "../src/core/storage/employeeDocuments.js";

const APPLY = process.argv.includes("--apply");

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

async function run() {
  console.log(APPLY ? "Mode: APPLY (database will be updated)" : "Mode: DRY RUN (no changes)");

  if (APPLY && !isStorageConfigured()) {
    throw new Error("S3 is not configured (S3_BUCKET_NAME / S3_ACCESS_KEY_ID missing in .env)");
  }

  const { rows } = await db.query(`
    SELECT id, employee_code, name, details
    FROM public.ca_employees
    WHERE jsonb_typeof(details->'documents') = 'array'
      AND details::text LIKE '%"data:%'
    ORDER BY id
  `);

  let employeesChanged = 0;
  let documentsMoved = 0;
  let documentsFailed = 0;
  let bytesRemoved = 0;

  for (const row of rows) {
    const details = row.details || {};
    const documents = Array.isArray(details.documents) ? details.documents : [];
    const pending = documents.filter(isBase64Document);
    if (pending.length === 0) continue;

    const size = pending.reduce((sum, doc) => sum + doc.url.length, 0);
    console.log(`- #${row.id} ${row.employee_code} ${row.name}: ${pending.length} document(s), ${formatBytes(size)}`);

    if (!APPLY) {
      documentsMoved += pending.length;
      bytesRemoved += size;
      employeesChanged += 1;
      continue;
    }

    const nextDocuments = [];
    let movedHere = 0;
    for (const doc of documents) {
      if (!isBase64Document(doc)) {
        nextDocuments.push(doc);
        continue;
      }
      try {
        nextDocuments.push(await uploadBase64Document(doc));
        movedHere += 1;
        bytesRemoved += doc.url.length;
      } catch (error) {
        console.error(`    upload failed for "${doc.name || "document"}": ${error?.message || error}`);
        nextDocuments.push(doc);
        documentsFailed += 1;
      }
    }

    if (movedHere > 0) {
      await db.query(
        `UPDATE public.ca_employees
         SET details = jsonb_set(details, '{documents}', $2::jsonb), updated_at = NOW()
         WHERE id = $1`,
        [row.id, JSON.stringify(nextDocuments)],
      );
      employeesChanged += 1;
      documentsMoved += movedHere;
    }
  }

  console.log("");
  console.log(`Employees ${APPLY ? "updated" : "to update"}: ${employeesChanged}`);
  console.log(`Documents ${APPLY ? "moved" : "to move"} to S3: ${documentsMoved}`);
  if (documentsFailed) console.log(`Documents failed (kept as base64): ${documentsFailed}`);
  console.log(`Base64 data ${APPLY ? "removed" : "to remove"} from DB: ${formatBytes(bytesRemoved)}`);
  if (!APPLY && employeesChanged > 0) {
    console.log("\nRun again with --apply to make these changes (take a DB backup first).");
  }
}

run()
  .then(async () => {
    await db.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Migration error:", error?.message || error);
    await db.end().catch(() => {});
    process.exit(1);
  });
