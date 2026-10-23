import { db } from "../../core/db/pool.js";

const hirepilotCredentialsTableSql = `
CREATE TABLE IF NOT EXISTS public.hirepilot_credentials (
  id SERIAL PRIMARY KEY,
  created_by_company_id INTEGER,
  establishment_id TEXT NOT NULL,
  establishment_name TEXT,
  platform TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT,
  account_id TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(establishment_id, platform)
);
`;

const hirepilotOpeningsTableSql = `
CREATE TABLE IF NOT EXISTS public.hirepilot_openings (
  id SERIAL PRIMARY KEY,
  created_by_company_id INTEGER,
  company_id TEXT,
  company_name TEXT,
  establishment_id TEXT NOT NULL,
  establishment_name TEXT,
  employee_id TEXT,
  employee_name TEXT,
  role_name TEXT NOT NULL,
  role_description TEXT,
  share_preferences JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Open',
  post_status TEXT DEFAULT 'Draft',
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const hirepilotApplicationsTableSql = `
CREATE TABLE IF NOT EXISTS public.hirepilot_applications (
  id SERIAL PRIMARY KEY,
  opening_id INTEGER REFERENCES public.hirepilot_openings(id) ON DELETE CASCADE,
  company_id INTEGER,
  establishment_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT,
  experience TEXT,
  current_ctc TEXT,
  expected_ctc TEXT,
  notice_period TEXT,
  portfolio_url TEXT,
  resume_data TEXT,
  resume_name TEXT,
  notes TEXT,
  status TEXT DEFAULT 'New',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

let ready = null;
const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      try {
        await db.query(hirepilotCredentialsTableSql);
        await db.query(hirepilotOpeningsTableSql);
        await db.query(`ALTER TABLE public.hirepilot_openings ADD COLUMN IF NOT EXISTS ai_post_content TEXT;`);
        await db.query(`ALTER TABLE public.hirepilot_openings ADD COLUMN IF NOT EXISTS min_ats_score INTEGER DEFAULT 70;`);
        await db.query(hirepilotApplicationsTableSql);
        await db.query(`ALTER TABLE public.hirepilot_applications ADD COLUMN IF NOT EXISTS ats_score INTEGER DEFAULT 0;`);
        await db.query(`ALTER TABLE public.hirepilot_applications ADD COLUMN IF NOT EXISTS ats_feedback TEXT;`);
        await db.query(`ALTER TABLE public.hirepilot_applications ADD COLUMN IF NOT EXISTS resume_url TEXT;`);
      } catch (err) {
        console.error("Error creating HirePilot tables:", err);
      }
    })();
  }
  return ready;
};

const mapCredential = (row) => ({
  id: String(row.id),
  companyId: row.created_by_company_id ? String(row.created_by_company_id) : null,
  establishmentId: row.establishment_id,
  establishmentName: row.establishment_name,
  platform: row.platform,
  clientId: row.client_id,
  clientSecret: row.client_secret,
  accountId: row.account_id,
  status: row.status || "Active",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapOpening = (row) => ({
  id: String(row.id),
  companyId: row.company_id,
  companyName: row.company_name,
  establishmentId: row.establishment_id,
  establishmentName: row.establishment_name,
  employeeId: row.employee_id,
  employeeName: row.employee_name,
  roleName: row.role_name,
  roleDescription: row.role_description,
  sharePreferences: Array.isArray(row.share_preferences) ? row.share_preferences : [],
  minAtsScore: Number(row.min_ats_score || 70),
  status: row.status || "Open",
  postStatus: row.post_status || "Draft",
  aiPostContent: row.ai_post_content || null,
  totalApplied: Number(row.total_applied || 0),
  totalAccepted: Number(row.total_accepted || 0),
  totalRejected: Number(row.total_rejected || 0),
  postedAt: row.posted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const hirePilotRepository = {
  async listCredentials(companyId, establishmentId) {
    await ensureTable();
    let query = `SELECT * FROM public.hirepilot_credentials WHERE 1=1`;
    const params = [];

    if (companyId) {
      params.push(companyId);
      query += ` AND (created_by_company_id = $${params.length} OR created_by_company_id IS NULL)`;
    }

    if (establishmentId && establishmentId !== "all") {
      params.push(establishmentId);
      query += ` AND establishment_id = $${params.length}`;
    }

    query += ` ORDER BY id DESC`;
    const { rows } = await db.query(query, params);
    return rows.map(mapCredential);
  },

  async saveCredential(companyId, payload) {
    await ensureTable();
    const {
      establishmentId,
      establishmentName,
      platform,
      clientId,
      clientSecret,
      accountId,
    } = payload;

    const query = `
      INSERT INTO public.hirepilot_credentials (
        created_by_company_id,
        establishment_id,
        establishment_name,
        platform,
        client_id,
        client_secret,
        account_id,
        status,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', NOW())
      ON CONFLICT (establishment_id, platform)
      DO UPDATE SET
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        account_id = EXCLUDED.account_id,
        establishment_name = EXCLUDED.establishment_name,
        updated_at = NOW()
      RETURNING *;
    `;

    const { rows } = await db.query(query, [
      companyId || null,
      establishmentId,
      establishmentName || "",
      platform,
      clientId,
      clientSecret || "",
      accountId || "",
    ]);

    return mapCredential(rows[0]);
  },

  async deleteCredential(id) {
    await ensureTable();
    await db.query(`DELETE FROM public.hirepilot_credentials WHERE id = $1`, [id]);
    return { success: true };
  },

  async listOpenings(companyId) {
    await ensureTable();
    let query = `
      SELECT 
        o.*,
        COALESCE(app.total_applied, 0) AS total_applied,
        COALESCE(app.total_accepted, 0) AS total_accepted,
        COALESCE(app.total_rejected, 0) AS total_rejected
      FROM public.hirepilot_openings o
      LEFT JOIN (
        SELECT 
          opening_id,
          COUNT(*) AS total_applied,
          COUNT(CASE WHEN LOWER(status) = 'accepted' THEN 1 END) AS total_accepted,
          COUNT(CASE WHEN LOWER(status) = 'rejected' THEN 1 END) AS total_rejected
        FROM public.hirepilot_applications
        GROUP BY opening_id
      ) app ON app.opening_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (companyId) {
      params.push(companyId);
      query += ` AND (o.created_by_company_id = $${params.length} OR o.created_by_company_id IS NULL)`;
    }

    query += ` ORDER BY o.id DESC`;
    const { rows } = await db.query(query, params);
    return rows.map(mapOpening);
  },

  async createOpening(companyId, payload) {
    await ensureTable();
    const {
      companyId: cId,
      companyName,
      establishmentId,
      establishmentName,
      employeeId,
      employeeName,
      roleName,
      roleDescription,
      sharePreferences,
    } = payload;

    const query = `
      INSERT INTO public.hirepilot_openings (
        created_by_company_id,
        company_id,
        company_name,
        establishment_id,
        establishment_name,
        employee_id,
        employee_name,
        role_name,
        role_description,
        share_preferences,
        min_ats_score,
        status,
        post_status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Open', 'Draft', NOW(), NOW())
      RETURNING *;
    `;

    const { rows } = await db.query(query, [
      companyId || null,
      cId || "",
      companyName || "",
      establishmentId,
      establishmentName || "",
      employeeId || "",
      employeeName || "",
      roleName,
      roleDescription || "",
      JSON.stringify(sharePreferences || []),
      Number(payload.minAtsScore || 70),
    ]);

    const created = mapOpening(rows[0]);

    // Also automatically insert into public.ca_job_requisitions so it is visible in Talent Acquisition Job Openings
    try {
      const cid = companyId ? parseInt(companyId, 10) : null;
      if (cid) {
        const countRes = await db.query(
          'SELECT COUNT(*) FROM public.ca_job_requisitions WHERE created_by_company_id = $1',
          [cid]
        );
        const nextNum = parseInt(countRes?.rows[0]?.count || 0, 10) + 1;
        const reqId = `REQ-${String(nextNum).padStart(3, '0')}`;

        await db.query(
          `
          INSERT INTO public.ca_job_requisitions (
            req_id, position, department, location, type, hiring_manager, positions_count, priority, budget, status, approval_status, target_date, experience, skills,
            establishment_id, establishment_name, created_by_company_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          `,
          [
            reqId,
            roleName,
            "General",
            establishmentName || "Corporate Office",
            "Full Time",
            employeeName || "",
            1,
            "Medium",
            "Best in Industry",
            "Open",
            "Approved",
            new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            "0-3 Years",
            JSON.stringify(Array.isArray(sharePreferences) ? sharePreferences : []),
            establishmentId || null,
            establishmentName || "",
            cid,
          ]
        );
      }
    } catch (syncErr) {
      console.warn("Syncing HirePilot opening to ca_job_requisitions non-critical error:", syncErr?.message);
    }

    return created;
  },

  async getOpeningById(id) {
    await ensureTable();
    const query = `
      SELECT 
        o.*,
        COALESCE(app.total_applied, 0) AS total_applied,
        COALESCE(app.total_accepted, 0) AS total_accepted,
        COALESCE(app.total_rejected, 0) AS total_rejected
      FROM public.hirepilot_openings o
      LEFT JOIN (
        SELECT 
          opening_id,
          COUNT(*) AS total_applied,
          COUNT(CASE WHEN LOWER(status) = 'accepted' OR LOWER(status) = 'interview' OR LOWER(status) = 'moved' THEN 1 END) AS total_accepted,
          COUNT(CASE WHEN LOWER(status) = 'rejected' THEN 1 END) AS total_rejected
        FROM public.hirepilot_applications
        GROUP BY opening_id
      ) app ON app.opening_id = o.id
      WHERE o.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] ? mapOpening(rows[0]) : null;
  },

  async deleteOpening(id) {
    await ensureTable();
    try {
      const { rows } = await db.query(
        `SELECT role_name, created_by_company_id FROM public.hirepilot_openings WHERE id = $1`,
        [id]
      );
      if (rows[0]) {
        const { role_name, created_by_company_id } = rows[0];
        if (created_by_company_id && role_name) {
          await db.query(
            `DELETE FROM public.ca_job_requisitions WHERE created_by_company_id = $1 AND LOWER(TRIM(position)) = LOWER(TRIM($2))`,
            [created_by_company_id, role_name]
          );
        }
      }
    } catch (e) {
      console.warn("Non-critical error deleting synced ca_job_requisition:", e?.message);
    }

    await db.query(`DELETE FROM public.hirepilot_openings WHERE id = $1`, [id]);
    return { success: true };
  },

  async postOpening(id, aiPostContent = null) {
    await ensureTable();
    const { rows } = await db.query(
      `UPDATE public.hirepilot_openings
       SET post_status = 'Posted',
           ai_post_content = COALESCE($2, ai_post_content),
           posted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, aiPostContent]
    );
    return rows[0] ? mapOpening(rows[0]) : null;
  },

  async submitApplication(openingId, payload, atsResult = {}, resumeUrl = null) {
    await ensureTable();
    const {
      fullName,
      email,
      phone,
      location,
      experience,
      currentCtc,
      expectedCtc,
      noticePeriod,
      portfolioUrl,
      resumeName,
      notes,
    } = payload;

    // Get opening to inherit company_id & establishment_id
    const { rows: openingRows } = await db.query(
      `SELECT created_by_company_id, establishment_id FROM public.hirepilot_openings WHERE id = $1`,
      [openingId]
    );
    const opening = openingRows[0] || {};

    const query = `
      INSERT INTO public.hirepilot_applications (
        opening_id,
        company_id,
        establishment_id,
        full_name,
        email,
        phone,
        location,
        experience,
        current_ctc,
        expected_ctc,
        notice_period,
        portfolio_url,
        resume_name,
        resume_url,
        notes,
        status,
        ats_score,
        ats_feedback
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const { rows } = await db.query(query, [
      openingId,
      opening.created_by_company_id || null,
      opening.establishment_id || null,
      fullName,
      email,
      phone,
      location || "",
      experience || "",
      currentCtc || "",
      expectedCtc || "",
      noticePeriod || "",
      portfolioUrl || "",
      resumeName || "",
      resumeUrl || null,
      notes || "",
      atsResult.status || "Applied",
      Number(atsResult.atsScore || 0),
      atsResult.feedback || "",
    ]);

    return rows[0];
  },

  async listAcceptedCandidates(openingId) {
    await ensureTable();
    const query = `
      SELECT * FROM public.hirepilot_applications 
      WHERE opening_id = $1 AND (LOWER(status) = 'accepted' OR LOWER(status) = 'interview' OR LOWER(status) = 'moved')
      ORDER BY ats_score DESC, created_at DESC
    `;
    const { rows } = await db.query(query, [openingId]);
    return rows.map((r) => ({
      id: String(r.id),
      openingId: String(r.opening_id),
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      location: r.location,
      experience: r.experience,
      currentCtc: r.current_ctc,
      expectedCtc: r.expected_ctc,
      noticePeriod: r.notice_period,
      portfolioUrl: r.portfolio_url,
      resumeName: r.resume_name,
      resumeUrl: r.resume_url,
      notes: r.notes,
      status: r.status,
      atsScore: Number(r.ats_score || 0),
      atsFeedback: r.ats_feedback,
      createdAt: r.created_at,
    }));
  },

  async moveCandidate(applicationId, newStatus = "Interview") {
    await ensureTable();
    const { rows } = await db.query(
      `UPDATE public.hirepilot_applications 
       SET status = $2, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [applicationId, newStatus]
    );
    return rows[0];
  },

  async listApplicationsByOpening(openingId) {
    await ensureTable();
    const { rows } = await db.query(
      `SELECT * FROM public.hirepilot_applications WHERE opening_id = $1 ORDER BY created_at DESC`,
      [openingId]
    );
    return rows;
  },
};
