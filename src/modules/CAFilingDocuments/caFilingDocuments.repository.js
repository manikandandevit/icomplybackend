import { db } from "../../core/db/pool.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS public.ca_filing_documents (
          id SERIAL PRIMARY KEY,
          created_by_company_id INTEGER NOT NULL,
          country VARCHAR(10) NOT NULL,
          establishment_id VARCHAR(50) NOT NULL,
          compliance_type VARCHAR(50) NOT NULL,
          filing_month VARCHAR(20) NOT NULL,
          filing_year VARCHAR(10) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          s3_key TEXT NOT NULL,
          file_url TEXT,
          mime_type VARCHAR(150),
          file_size INTEGER,
          uploaded_by VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_ca_filing_documents_filing
        ON public.ca_filing_documents (created_by_company_id, country, establishment_id, compliance_type, filing_month, filing_year)
      `);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
};

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const toDocument = (row) => ({
  id: String(row.id),
  country: row.country,
  establishmentId: row.establishment_id,
  complianceType: row.compliance_type,
  month: row.filing_month,
  year: row.filing_year,
  fileName: row.file_name,
  fileUrl: row.file_url || "",
  mimeType: row.mime_type || "",
  fileSize: row.file_size != null ? Number(row.file_size) : 0,
  uploadedBy: row.uploaded_by || "",
  uploadedAt: row.created_at,
});

export const caFilingDocumentsRepository = {
  async create(companyId, doc) {
    await ensureTable();
    const { rows } = await db.query(
      `
      INSERT INTO public.ca_filing_documents
        (created_by_company_id, country, establishment_id, compliance_type, filing_month, filing_year,
         file_name, s3_key, file_url, mime_type, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        parseRowId(companyId),
        doc.country,
        doc.establishmentId,
        doc.complianceType,
        doc.month,
        doc.year,
        doc.fileName,
        doc.s3Key,
        doc.fileUrl,
        doc.mimeType,
        doc.fileSize,
        doc.uploadedBy,
      ],
    );
    return toDocument(rows[0]);
  },

  async list(companyId, filters = {}) {
    await ensureTable();
    const params = [parseRowId(companyId)];
    const where = ["created_by_company_id = $1"];
    const add = (column, value) => {
      if (value) {
        params.push(String(value));
        where.push(`${column} = $${params.length}`);
      }
    };
    add("country", filters.country);
    add("establishment_id", filters.establishmentId);
    add("compliance_type", filters.complianceType);
    add("filing_month", filters.month);
    add("filing_year", filters.year);

    const { rows } = await db.query(
      `SELECT * FROM public.ca_filing_documents WHERE ${where.join(" AND ")} ORDER BY created_at ASC, id ASC`,
      params,
    );
    return rows.map(toDocument);
  },

  /** Raw row (with the S3 key) for download/delete. */
  async findRaw(companyId, id) {
    await ensureTable();
    const docId = parseRowId(id);
    if (!docId) return null;
    const { rows } = await db.query(
      `SELECT * FROM public.ca_filing_documents WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
      [docId, parseRowId(companyId)],
    );
    return rows[0] ?? null;
  },

  async remove(companyId, id) {
    await ensureTable();
    const { rowCount } = await db.query(
      `DELETE FROM public.ca_filing_documents WHERE id = $1 AND created_by_company_id = $2`,
      [parseRowId(id), parseRowId(companyId)],
    );
    return rowCount > 0;
  },
};
