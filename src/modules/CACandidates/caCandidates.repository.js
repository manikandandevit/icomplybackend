import { db } from "../../core/db/pool.js";
import { caCandidatesTableSql, mapCACandidate } from "./caCandidates.constants.js";
import { caOffersRepository } from "../CAOffers/caOffers.repository.js";
import { mapCAInterview } from "../CAInterviews/caInterviews.constants.js";
import { mapCAOffer } from "../CAOffers/caOffers.constants.js";

let ready = null;
const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caCandidatesTableSql);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS assessment_count INTEGER DEFAULT 0;`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS email VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS experience VARCHAR(50);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS location VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS establishment_id VARCHAR(100);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS establishment_name VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS expected_ctc VARCHAR(100);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS highest_qualification VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS notice_period VARCHAR(100);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS resume_url TEXT;`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS resume_name VARCHAR(255);`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;`);
      await db.query(`ALTER TABLE public.ca_candidates ADD COLUMN IF NOT EXISTS workflow_stages JSONB DEFAULT '[]'::jsonb;`);
      await db.query(`ALTER TABLE IF EXISTS public.ca_candidates ALTER COLUMN stage TYPE VARCHAR(255);`);
      await db.query(`ALTER TABLE IF EXISTS public.ca_candidates ADD COLUMN IF NOT EXISTS current_round VARCHAR(255);`);
      await db.query(`ALTER TABLE IF EXISTS public.ca_candidates ADD COLUMN IF NOT EXISTS pre_joining_checklist JSONB DEFAULT '{}'::jsonb;`);
    })();
  }
  return ready;
};

export const caCandidatesRepository = {
  async findById(id, companyId) {
    await ensureTable();
    let query = `
      SELECT 
        c.*,
        (
          SELECT COALESCE(NULLIF(i.round_name, ''), NULLIF(i.type, ''))
          FROM public.ca_interviews i
          WHERE (i.candidate_id = c.id)
          ORDER BY 
            CASE WHEN LOWER(COALESCE(i.status, '')) = 'scheduled' THEN 1 ELSE 2 END,
            i.id DESC
          LIMIT 1
        ) AS latest_round_name
      FROM public.ca_candidates c 
      WHERE c.id = $1
    `;
    const params = [id];
    if (companyId) {
      params.push(companyId);
      query += ` AND (c.created_by_company_id = $2 OR c.created_by_company_id IS NULL)`;
    }
    const { rows } = await db.query(query, params);
    if (rows[0]) {
      return mapCACandidate(rows[0]);
    }

    if (Number(id) >= 100000) {
      try {
        const hpId = Number(id) - 100000;
        const hpRes = await db.query(
          `SELECT 
            (a.id + 100000) AS id,
            a.full_name AS name,
            COALESCE(
              NULLIF(CONCAT(SUBSTRING(SPLIT_PART(a.full_name, ' ', 1), 1, 1), SUBSTRING(SPLIT_PART(a.full_name, ' ', 2), 1, 1)), ''),
              SUBSTRING(a.full_name, 1, 2)
            ) AS initials,
            CONCAT(COALESCE(NULLIF(a.experience, ''), '0 yrs'), ' · ', COALESCE(NULLIF(a.location, ''), 'Remote')) AS details,
            o.role_name AS role,
            COALESCE(a.ats_score, 75) AS match,
            CASE 
              WHEN LOWER(a.status) = 'accepted' THEN 'Shortlisted'
              WHEN LOWER(a.status) = 'interview' OR LOWER(a.status) = 'moved' THEN 'Interview'
              WHEN LOWER(a.status) = 'rejected' THEN 'Rejected'
              ELSE 'Applied'
            END AS stage,
            'HirePilot' AS source,
            TO_CHAR(COALESCE(a.created_at, NOW()), 'DD Mon YYYY') AS applied,
            '[]'::jsonb AS notes,
            0 AS assessment_count,
            a.email,
            a.phone,
            a.experience,
            a.location,
            '[]'::jsonb AS skills,
            a.resume_url AS resume_url,
            'Resume.pdf' AS resume_name,
            COALESCE(a.establishment_id, o.establishment_id) AS establishment_id,
            o.establishment_name AS establishment_name,
            COALESCE(a.company_id, o.created_by_company_id, 1) AS created_by_company_id
          FROM public.hirepilot_applications a
          JOIN public.hirepilot_openings o ON o.id = a.opening_id
          WHERE a.id = $1`,
          [hpId]
        );
        if (hpRes.rows[0]) {
          return mapCACandidate(hpRes.rows[0]);
        }
      } catch (e) {
        console.warn("Could not find HirePilot application by id:", e.message);
      }
    }
    return null;
  },

  async list(companyId, filter = {}) {
    await ensureTable();
    let query = `
      SELECT 
        c.*,
        (
          SELECT COALESCE(NULLIF(i.round_name, ''), NULLIF(i.type, ''))
          FROM public.ca_interviews i
          WHERE (i.candidate_id = c.id)
          ORDER BY 
            CASE WHEN LOWER(COALESCE(i.status, '')) = 'scheduled' THEN 1 ELSE 2 END,
            i.id DESC
          LIMIT 1
        ) AS latest_round_name
      FROM public.ca_candidates c 
      WHERE 1=1
    `;
    const params = [];
    if (companyId) {
      params.push(companyId);
      query += ` AND (c.created_by_company_id = $${params.length} OR c.created_by_company_id IS NULL)`;
    }
    if (filter.role && filter.role.trim()) {
      params.push(`%${filter.role.trim()}%`);
      query += ` AND c.role ILIKE $${params.length}`;
    }
    if (filter.stage && filter.stage.trim()) {
      params.push(filter.stage.trim());
      query += ` AND (c.stage = $${params.length} OR ($${params.length} = 'Interview' AND (c.stage ILIKE '%round%' OR c.stage ILIKE '%interview%')))`;
    }
    query += ` ORDER BY c.id DESC`;
    const { rows } = await db.query(query, params);
    const standardCandidates = rows.map(mapCACandidate);

    // Also include candidates from HirePilot applications table
    try {
      let hpQuery = `
        SELECT 
          (a.id + 100000) AS id,
          a.full_name AS name,
          COALESCE(
            NULLIF(CONCAT(SUBSTRING(SPLIT_PART(a.full_name, ' ', 1), 1, 1), SUBSTRING(SPLIT_PART(a.full_name, ' ', 2), 1, 1)), ''),
            SUBSTRING(a.full_name, 1, 2)
          ) AS initials,
          CONCAT(COALESCE(NULLIF(a.experience, ''), '0 yrs'), ' · ', COALESCE(NULLIF(a.location, ''), 'Remote')) AS details,
          o.role_name AS role,
          COALESCE(a.ats_score, 75) AS match,
          CASE 
            WHEN LOWER(a.status) = 'accepted' THEN 'Shortlisted'
            WHEN LOWER(a.status) = 'interview' OR LOWER(a.status) = 'moved' THEN 'Round 1: Technical interview'
            WHEN LOWER(a.status) = 'rejected' THEN 'Rejected'
            ELSE 'Applied'
          END AS stage,
          (
            SELECT COALESCE(NULLIF(i.round_name, ''), NULLIF(i.type, ''))
            FROM public.ca_interviews i
            WHERE (i.candidate_id = (a.id + 100000) OR i.candidate_id = a.id)
            ORDER BY 
              CASE WHEN LOWER(COALESCE(i.status, '')) = 'scheduled' THEN 1 ELSE 2 END,
              i.id DESC
            LIMIT 1
          ) AS latest_round_name,
          'HirePilot' AS source,
          TO_CHAR(COALESCE(a.created_at, NOW()), 'DD Mon YYYY') AS applied,
          '[]'::jsonb AS notes,
          0 AS assessment_count,
          a.email,
          a.phone,
          a.experience,
          a.location,
          '[]'::jsonb AS skills,
          a.resume_url AS resume_url,
          'Resume.pdf' AS resume_name,
          COALESCE(a.establishment_id, o.establishment_id) AS establishment_id,
          o.establishment_name AS establishment_name,
          COALESCE(a.company_id, o.created_by_company_id, 1) AS created_by_company_id
        FROM public.hirepilot_applications a
        JOIN public.hirepilot_openings o ON o.id = a.opening_id
        WHERE 1=1
      `;
      const hpParams = [];
      if (companyId) {
        hpParams.push(companyId);
        hpQuery += ` AND (a.company_id = $${hpParams.length} OR o.created_by_company_id = $${hpParams.length} OR a.company_id IS NULL)`;
      }
      if (filter.role && filter.role.trim()) {
        hpParams.push(`%${filter.role.trim()}%`);
        hpQuery += ` AND o.role_name ILIKE $${hpParams.length}`;
      }
      if (filter.stage && filter.stage.trim()) {
        hpParams.push(filter.stage.trim());
        hpQuery += ` AND (
          CASE 
            WHEN LOWER(a.status) = 'accepted' THEN 'Shortlisted'
            WHEN LOWER(a.status) = 'interview' OR LOWER(a.status) = 'moved' THEN 'Round 1: Technical interview'
            WHEN LOWER(a.status) = 'rejected' THEN 'Rejected'
            ELSE 'Applied'
          END = $${hpParams.length}
        )`;
      }
      hpQuery += ` ORDER BY a.id DESC`;

      const { rows: hpRows } = await db.query(hpQuery, hpParams);
      const hpCandidates = hpRows.map(mapCACandidate);

      // Avoid duplicate names if any
      const existingNames = new Set(standardCandidates.map(c => c.name?.trim().toLowerCase()));
      const uniqueHp = hpCandidates.filter(c => !existingNames.has(c.name?.trim().toLowerCase()));

      return [...standardCandidates, ...uniqueHp];
    } catch (hpErr) {
      console.warn("Could not merge hirepilot applications into candidates:", hpErr?.message);
      return standardCandidates;
    }
  },

  async create(companyId, payload) {
    await ensureTable();
    const cleanEmail = payload.email ? String(payload.email).trim() : null;
    const cleanPhone = payload.phone ? String(payload.phone).trim() : null;

    let establishmentId = payload.establishmentId ? String(payload.establishmentId).trim() : null;
    let establishmentName = payload.establishmentName ? String(payload.establishmentName).trim() : null;
    let targetCompanyId = companyId;

    // Auto-inherit Company and Establishment from Job Position / Requisition
    if (payload.role && (!establishmentId || !establishmentName)) {
      try {
        const reqRes = await db.query(
          `SELECT establishment_id, establishment_name, created_by_company_id
           FROM public.ca_job_requisitions
           WHERE LOWER(TRIM(position)) = LOWER(TRIM($1))
             AND establishment_id IS NOT NULL AND establishment_id <> ''
           ORDER BY (CASE WHEN created_by_company_id = $2 THEN 0 ELSE 1 END), id DESC
           LIMIT 1`,
          [payload.role, companyId || 0]
        );
        if (reqRes.rows[0]) {
          if (!establishmentId) establishmentId = String(reqRes.rows[0].establishment_id);
          if (!establishmentName) establishmentName = reqRes.rows[0].establishment_name;
          if (!targetCompanyId && reqRes.rows[0].created_by_company_id) {
            targetCompanyId = reqRes.rows[0].created_by_company_id;
          }
        } else {
          const openRes = await db.query(
            `SELECT establishment_id, establishment_name, created_by_company_id, company_id
             FROM public.hirepilot_openings
             WHERE LOWER(TRIM(role_name)) = LOWER(TRIM($1))
               AND establishment_id IS NOT NULL AND establishment_id <> ''
             ORDER BY (CASE WHEN created_by_company_id = $2 THEN 0 ELSE 1 END), id DESC
             LIMIT 1`,
            [payload.role, companyId || 0]
          );
          if (openRes.rows[0]) {
            if (!establishmentId) establishmentId = String(openRes.rows[0].establishment_id);
            if (!establishmentName) establishmentName = openRes.rows[0].establishment_name;
            if (!targetCompanyId) {
              targetCompanyId = openRes.rows[0].created_by_company_id || parseInt(openRes.rows[0].company_id, 10);
            }
          }
        }
      } catch (err) {
        console.warn("Could not auto-inherit establishment from position:", err?.message);
      }
    }

    // If establishmentId is set but establishmentName is empty, look up in ca_establishments
    if (establishmentId && !establishmentName) {
      try {
        const estRes = await db.query('SELECT name, company_id FROM public.ca_establishments WHERE id = $1', [establishmentId]);
        if (estRes.rows[0]) {
          establishmentName = estRes.rows[0].name;
          if (!targetCompanyId && estRes.rows[0].company_id) {
            targetCompanyId = estRes.rows[0].company_id;
          }
        }
      } catch (estErr) {
        console.warn("Could not lookup establishment name:", estErr?.message);
      }
    }

    const { rows } = await db.query(
      `INSERT INTO public.ca_candidates (
        name, initials, details, role, match, stage, source, applied, assessment_count, email, phone, experience, location, skills,
        establishment_id, establishment_name, expected_ctc, highest_qualification, notice_period,
        resume_url, resume_name,
        created_by_company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING *`,
      [
        payload.name, payload.initials, payload.details, payload.role, payload.match, payload.stage, 
        payload.source, payload.applied, payload.assessmentCount || 0, 
        cleanEmail, cleanPhone, payload.experience || null, payload.location || null,
        payload.skills ? JSON.stringify(payload.skills) : '[]',
        establishmentId || null, establishmentName || null,
        payload.expectedCtc || null, payload.highestQualification || null, payload.noticePeriod || null,
        payload.resumeUrl || null, payload.resumeName || null,
        targetCompanyId || companyId
      ]
    );
    const candidate = mapCACandidate(rows[0]);

    // Synchronize candidate email across any duplicate/older records with same name that lack an email
    if (cleanEmail && candidate?.name) {
      try {
        await db.query(
          `UPDATE public.ca_candidates 
           SET email = $1, phone = COALESCE(phone, $2)
           WHERE LOWER(TRIM(name)) = LOWER(TRIM($3)) AND (email IS NULL OR email = '')`,
          [cleanEmail, cleanPhone, candidate.name]
        );
      } catch (syncErr) {
        console.warn("Could not sync email to matching candidates:", syncErr.message);
      }
    }

    if (candidate && candidate.stage === 'Offer') {
      try {
        await caOffersRepository.ensureOfferForCandidate(companyId, candidate);
      } catch (err) {
        console.error("Failed to auto-create offer on candidate create:", err);
      }
    }
    return candidate;
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const initials = payload.name
      ? payload.name
          .split(' ')
          .map(w => w[0])
          .join('')
          .slice(0, 4)
          .toUpperCase()
      : undefined;

    const details = (payload.experience !== undefined || payload.location !== undefined)
      ? `${payload.experience || '0 yrs'} · ${payload.location || 'Remote'}`
      : undefined;

    const cleanEmail = payload.email !== undefined ? (payload.email ? String(payload.email).trim() : null) : undefined;
    const cleanPhone = payload.phone !== undefined ? (payload.phone ? String(payload.phone).trim() : null) : undefined;

    let establishmentId = payload.establishmentId !== undefined ? (payload.establishmentId ? String(payload.establishmentId).trim() : null) : undefined;
    let establishmentName = payload.establishmentName !== undefined ? (payload.establishmentName ? String(payload.establishmentName).trim() : null) : undefined;

    if (establishmentId && !establishmentName) {
      try {
        const estRes = await db.query('SELECT name FROM public.ca_establishments WHERE id = $1', [establishmentId]);
        if (estRes.rows[0]) {
          establishmentName = estRes.rows[0].name;
        }
      } catch (estErr) {
        console.warn("Could not lookup establishment name on update:", estErr?.message);
      }
    } else if (!establishmentId && payload.role) {
      try {
        const reqRes = await db.query(
          `SELECT establishment_id, establishment_name
           FROM public.ca_job_requisitions
           WHERE LOWER(TRIM(position)) = LOWER(TRIM($1))
             AND establishment_id IS NOT NULL AND establishment_id <> ''
           ORDER BY (CASE WHEN created_by_company_id = $2 THEN 0 ELSE 1 END), id DESC
           LIMIT 1`,
          [payload.role, companyId || 0]
        );
        if (reqRes.rows[0]) {
          establishmentId = String(reqRes.rows[0].establishment_id);
          establishmentName = reqRes.rows[0].establishment_name;
        }
      } catch (err) {
        console.warn("Could not lookup role establishment on update:", err?.message);
      }
    }

    let query = `UPDATE public.ca_candidates 
       SET name = COALESCE($3, name),
           initials = COALESCE($4, initials),
           role = COALESCE($5, role),
           details = COALESCE($6, details),
           experience = COALESCE($7, experience),
           location = COALESCE($8, location),
           email = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE email END,
           phone = CASE WHEN $10::text IS NOT NULL THEN $10 ELSE phone END,
           source = COALESCE($11, source),
           skills = COALESCE($12::jsonb, skills),
           establishment_id = COALESCE($13, establishment_id),
           establishment_name = COALESCE($14, establishment_name),
           expected_ctc = COALESCE($15, expected_ctc),
           highest_qualification = COALESCE($16, highest_qualification),
           notice_period = COALESCE($17, notice_period),
           resume_url = COALESCE($18, resume_url),
           resume_name = COALESCE($19, resume_name),
           updated_at = NOW()
       WHERE id = $1`;
    const params = [
      id,
      companyId,
      payload.name || null,
      initials || null,
      payload.role || null,
      details || null,
      payload.experience || null,
      payload.location || null,
      cleanEmail !== undefined ? cleanEmail : null,
      cleanPhone !== undefined ? cleanPhone : null,
      payload.source || null,
      payload.skills ? JSON.stringify(payload.skills) : null,
      establishmentId !== undefined ? establishmentId : null,
      establishmentName !== undefined ? establishmentName : null,
      payload.expectedCtc !== undefined ? payload.expectedCtc : null,
      payload.highestQualification !== undefined ? payload.highestQualification : null,
      payload.noticePeriod !== undefined ? payload.noticePeriod : null,
      payload.resumeUrl !== undefined ? payload.resumeUrl : null,
      payload.resumeName !== undefined ? payload.resumeName : null,
    ];
    if (companyId) {
      query += ` AND (created_by_company_id = $2 OR created_by_company_id IS NULL)`;
    }
    query += ` RETURNING *`;

    const { rows } = await db.query(query, params);
    const updated = rows[0] ? mapCACandidate(rows[0]) : null;
    if (updated) {
      // Sync candidate email and name across database records and related tables
      try {
        if (updated.email) {
          await db.query(
            `UPDATE public.ca_candidates 
             SET email = $1 
             WHERE LOWER(TRIM(name)) = LOWER(TRIM($2)) AND (email IS NULL OR email = '')`,
            [updated.email, updated.name]
          );
        }
        await db.query(
          `UPDATE public.ca_interviews 
           SET role = COALESCE($3, role) 
           WHERE candidate_id = $1 AND (created_by_company_id = $2 OR created_by_company_id IS NULL)`,
          [id, companyId, updated.role]
        );
        await db.query(
          `UPDATE public.ca_offers 
           SET candidate_name = COALESCE($3, candidate_name),
               role = COALESCE($4, role)
           WHERE candidate_id = $1 AND (created_by_company_id = $2 OR created_by_company_id IS NULL)`,
          [id, companyId, updated.name, updated.role]
        );
      } catch (err) {
        console.warn("Could not sync updated candidate to interviews/offers:", err.message);
      }
    }
    return updated;
  },

  async updateStage(id, companyId, stage, assessmentCount) {
    await ensureTable();
    
    let candidate = null;
    if (assessmentCount !== undefined) {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates SET stage = $3, assessment_count = $4, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
        [id, companyId, stage, assessmentCount]
      );
      candidate = rows[0] ? mapCACandidate(rows[0]) : null;
    } else {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates SET stage = $3, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
        [id, companyId, stage]
      );
      candidate = rows[0] ? mapCACandidate(rows[0]) : null;
    }

    if (candidate) {
      if (stage === 'Interview') {
        try {
          const existingInt = await db.query(
            `SELECT id FROM public.ca_interviews WHERE candidate_id = $1 AND created_by_company_id = $2 LIMIT 1`,
            [id, companyId]
          );
          if (!existingInt.rows[0]) {
            const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            await db.query(
              `INSERT INTO public.ca_interviews (
                created_by_company_id, candidate_id, role, interviewer, type, datetime, mode, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                companyId,
                id,
                candidate.role || 'Software Engineer',
                'Assigned Interviewer',
                'Round 1 - Technical',
                `${todayStr} · 10:00 AM`,
                'Video',
                'Scheduled'
              ]
            );
          }
        } catch (err) {
          console.error("Failed to auto-create interview entry on stage change to Interview:", err);
        }
      }

      if (stage === 'Offer') {
        try {
          await caOffersRepository.ensureOfferForCandidate(companyId, candidate);
        } catch (err) {
          console.error("Failed to auto-create offer on updateStage:", err);
        }
      } else if (stage === 'Hired' || stage === 'Offer Acceptance' || stage === 'Onboarding') {
        try {
          await db.query(
            `UPDATE public.ca_offers SET status = 'Accepted', updated_at = NOW() 
             WHERE candidate_id = $1 
               AND (created_by_company_id = $2 OR $2 IS NULL)`,
            [id, companyId]
          );

          const todayStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
          let defaultAssignee = "";
          try {
            const candEstId = candidate.establishmentId || candidate.establishment_id;
            const empRes = await db.query(
              `SELECT name FROM public.ca_employees 
               WHERE (establishment_id = $1::integer OR $1 IS NULL) 
                 AND (company_id = $2 OR $2 IS NULL) 
                 AND (status IS NULL OR status != 'Inactive') 
               ORDER BY id ASC LIMIT 1`,
              [candEstId ? Number(candEstId) : null, companyId ? Number(companyId) : null]
            );
            if (empRes.rows[0]) {
              defaultAssignee = empRes.rows[0].name;
            }
          } catch (e) {}

          const allCompletedStages = [
            { id: "workflow-doc-collection", type: "workflow", stageKey: "document_collection", title: "Document collection", status: "Completed", date: todayStr, assignedTo: defaultAssignee, canMarkDone: false },
            { id: "workflow-offer-gen", type: "workflow", stageKey: "offer_generated", title: "Offer generated", status: "Completed", date: todayStr, assignedTo: defaultAssignee, canMarkDone: false },
            { id: "workflow-offer-approval", type: "workflow", stageKey: "offer_approval", title: "Offer approval", status: "Completed", date: todayStr, assignedTo: defaultAssignee, canMarkDone: false },
            { id: "workflow-offer-release", type: "workflow", stageKey: "offer_release", title: "Offer release", status: "Completed", date: todayStr, assignedTo: defaultAssignee, canMarkDone: false },
            { id: "workflow-offer-acceptance", type: "workflow", stageKey: "offer_acceptance", title: "Offer acceptance", status: "Completed", date: todayStr, assignedTo: defaultAssignee, canMarkDone: false }
          ];
          await db.query(
            `UPDATE public.ca_candidates SET workflow_stages = $2, updated_at = NOW() WHERE id = $1`,
            [id, JSON.stringify(allCompletedStages)]
          );
        } catch (err) {
          console.error("Failed to sync offer status to Accepted on updateStage:", err);
        }
      } else if (stage === "Rejected") {
        // Candidate marked as Rejected: clean up any pending offers and cancel scheduled interviews
        try {
          await db.query(
            `DELETE FROM public.ca_offers 
             WHERE candidate_id = $1 
               AND (created_by_company_id = $2 OR $2 IS NULL)`,
            [id, companyId]
          );
          await db.query(
            `UPDATE public.ca_interviews
             SET status = 'Cancelled', is_frozen = TRUE, updated_at = NOW()
             WHERE candidate_id = $1 AND (created_by_company_id = $2 OR $2 IS NULL) AND status = 'Scheduled'`,
            [id, companyId]
          );
          await db.query(
            `UPDATE public.ca_candidates SET workflow_stages = '[]'::jsonb WHERE id = $1`,
            [id]
          );
        } catch (err) {
          console.error("Failed to clean up on Rejected stage:", err);
        }
      }
    }

    return candidate;
  },

  async addNote(id, companyId, noteText) {
    await ensureTable();
    const note = {
      text: noteText,
      createdAt: new Date().toISOString()
    };
    const { rows } = await db.query(
      `UPDATE public.ca_candidates SET notes = notes || $3::jsonb, updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2 RETURNING *`,
      [id, companyId, JSON.stringify([note])]
    );
    return rows[0] ? mapCACandidate(rows[0]) : null;
  },

  async delete(id, companyId) {
    await ensureTable();
    await db.query(`DELETE FROM public.ca_offers WHERE candidate_id = $1 AND created_by_company_id = $2`, [id, companyId]);
    await db.query(`DELETE FROM public.ca_interviews WHERE candidate_id = $1 AND created_by_company_id = $2`, [id, companyId]);
    const { rows } = await db.query(
      `DELETE FROM public.ca_candidates WHERE id = $1 AND created_by_company_id = $2 RETURNING id`,
      [id, companyId]
    );
    return rows.length > 0;
  },

  async getTimeline(id, companyId) {
    await ensureTable();
    let candidate = await this.findById(id, companyId);

    // Support dummy / fallback candidate for seamless preview
    if (!candidate && (Number(id) < 0 || id === "dummy" || isNaN(Number(id)))) {
      const numId = Number(id);
      if (numId === -4) {
        candidate = {
          id: -4,
          name: "Neha Gupta",
          initials: "NG",
          details: "3 yrs · Pune",
          role: "Data Analyst",
          match: 85,
          stage: "Assessment",
          source: "LinkedIn",
          applied: "12 Sep 2026",
          email: "neha.gupta@email.com",
          phone: "+91 65432 10987",
          location: "Pune",
          skills: ["Python", "SQL", "Tableau"],
          documents: [],
        };
      } else {
        const arjunDb = await db.query(
          `SELECT email, phone, role FROM public.ca_candidates WHERE LOWER(TRIM(name)) = 'arjun mehta' AND email IS NOT NULL AND email != '' ORDER BY id DESC LIMIT 1`
        );
        candidate = {
          id: Number(id) || -1,
          name: "Arjun Mehta",
          initials: "AM",
          details: "Senior Software Engineer · 6 yrs",
          role: arjunDb.rows[0]?.role || "Senior Software Engineer",
          match: 92,
          stage: "Interview",
          source: "LinkedIn",
          applied: "10 Sep 2026",
          email: arjunDb.rows[0]?.email || null,
          phone: arjunDb.rows[0]?.phone || "+91 98765 43210",
          location: "Bangalore",
          skills: ["React", "Node.js", "AWS"],
          documents: [],
        };
      }
    }

    if (!candidate) {
      return null;
    }

    // Ensure candidate has clean fields and uses DB-stored email
    if (!candidate.email && candidate.name) {
      const emailRow = await db.query(
        `SELECT email, phone FROM public.ca_candidates WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND email IS NOT NULL AND email != '' ORDER BY id DESC LIMIT 1`,
        [candidate.name]
      );
      if (emailRow.rows[0]?.email) {
        candidate.email = emailRow.rows[0].email;
        if (!candidate.phone && emailRow.rows[0].phone) {
          candidate.phone = emailRow.rows[0].phone;
        }
      }
    }
    if (!candidate.phone) {
      candidate.phone = "+91 98765 43210";
    }
    if (!candidate.location) {
      candidate.location = candidate.details?.split("·")[1]?.trim() || "Bangalore";
    }
    if (!candidate.skills || candidate.skills.length === 0) {
      candidate.skills = ["React", "Node.js", "AWS"];
    }

    // Fetch interviews for this candidate (strictly isolate by candidate.id for real records)
    let interviewQuery;
    let params;
    if (Number(candidate.id) > 0) {
      interviewQuery = `
        SELECT i.*, c.email as candidate_email, c.name as candidate_name
        FROM public.ca_interviews i 
        LEFT JOIN public.ca_candidates c ON i.candidate_id = c.id
        WHERE (i.candidate_id = $1 OR i.candidate_id = ($1 + 100000))
          AND LOWER(COALESCE(i.interviewer, '')) != 'gowri'
        ORDER BY i.id ASC
      `;
      params = [candidate.id];
    } else {
      interviewQuery = `
        SELECT i.*, c.email as candidate_email, c.name as candidate_name
        FROM public.ca_interviews i 
        LEFT JOIN public.ca_candidates c ON i.candidate_id = c.id
        WHERE (i.candidate_id = $1 OR (c.name IS NOT NULL AND LOWER(TRIM(c.name)) = LOWER(TRIM($2))))
          AND LOWER(COALESCE(i.interviewer, '')) != 'gowri'
        ORDER BY i.id ASC
      `;
      params = [candidate.id, candidate.name || ''];
    }
    let { rows: interviewRows } = await db.query(interviewQuery, params);

    const isCandidateRejected = (candidate.stage || "").toLowerCase() === 'rejected';

    // If real DB candidate has no interviews yet, auto-create initial Round 1 interview only if in Interview stage and not rejected
    if (interviewRows.length === 0 && candidate.id && Number(candidate.id) > 0 && !isCandidateRejected && candidate.stage === 'Interview') {
      try {
        const isInitialNeha = (candidate.name || "").toLowerCase().includes("neha") && Number(candidate.id) <= 0;
        const isInitialArjun = (candidate.name || "").toLowerCase().includes("arjun") && Number(candidate.id) <= 0;
        const inserted = await db.query(
          `INSERT INTO public.ca_interviews (
            created_by_company_id, candidate_id, role, interviewer, type, round_name, datetime, mode, status, invite_sent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE) RETURNING *`,
          [
            candidate.created_by_company_id || companyId || 1,
            candidate.id,
            candidate.role || "Software Engineer",
            isInitialNeha ? "Suresh Reddy" : "Rajesh Kumar",
            "Round 1: Technical interview",
            "Round 1: Technical interview",
            isInitialNeha ? "17 Sep 2026 · 11:00 AM" : "16 Sep 2026 · 10:00 AM",
            "Video",
            isInitialArjun ? "Completed" : "Scheduled",
          ]
        );
        if (inserted.rows[0]) {
          interviewRows = [inserted.rows[0]];
        }
      } catch (err) {
        console.warn("Could not auto-create initial interview:", err.message);
      }
    }

    const isNeha = (candidate.name || "").toLowerCase().includes("neha") && Number(candidate.id) <= 0;
    const isArjun = (candidate.name || "").toLowerCase().includes("arjun") && Number(candidate.id) <= 0;

    const timeline = [];

    // 1. Application event (Applied)
    timeline.push({
      id: `applied-${candidate.id}`,
      type: "applied",
      title: "Applied",
      subtitle: `via ${isArjun ? "LinkedIn" : (candidate.source || "LinkedIn")} · AI match ${isArjun ? 92 : (candidate.match || 92)}%`,
      date: isArjun ? "10 Sep 2026" : (candidate.applied || "10 Sep 2026"),
    });

    const interviewRounds = [];

    // Base Round 1: Technical interview only for fallback/demo candidates (id <= 0)
    if ((isArjun || isNeha) && interviewRows.length === 0 && !isCandidateRejected) {
      interviewRounds.push({
        id: 101,
        interviewId: 101,
        type: "interview",
        roundName: "Round 1: Technical interview",
        interviewer: isNeha ? "Suresh Reddy" : "Rajesh Kumar",
        time: isNeha ? "11:00 AM" : "10:00 AM",
        date: isNeha ? "17 Sep 2026" : "16 Sep 2026",
        datetime: isNeha ? "17 Sep 2026 · 11:00 AM" : "16 Sep 2026 · 10:00 AM",
        mode: "Video",
        status: isArjun ? "Completed" : "Scheduled",
        inviteSent: false,
        feedback: isArjun ? "Good" : "",
        rating: isArjun ? 3 : 0,
      });
    }

    // Custom scheduled rounds from DB
    if (interviewRows.length > 0) {
      interviewRows.forEach((row, i) => {
        const interview = mapCAInterview(row);
        let datePart = "21 Oct 2026";
        let timePart = "10:00 AM";

        if (interview.datetime) {
          const parts = interview.datetime.split("·");
          if (parts.length >= 2) {
            datePart = parts[0].trim();
            timePart = parts[1].trim();
          } else {
            timePart = interview.datetime.trim();
          }
        }

        // Format date properly if it is in ISO format YYYY-MM-DD
        if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const d = new Date(datePart);
          if (!isNaN(d.getTime())) {
            datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
          }
        }

        const roundIdx = i + 1;
        const rawType = (interview.type || interview.roundName || "Technical")
          .replace(/^round\s*\d+\s*[:-]?\s*/i, "")
          .trim();
        const typeLabel = rawType.toLowerCase().includes("interview") || rawType.toLowerCase().includes("round")
          ? rawType
          : `${rawType} interview`;
        const roundTitle = `Round ${roundIdx}: ${typeLabel}`;

        const effectiveStatus = isCandidateRejected && (interview.status === "Scheduled" || !interview.status)
          ? "Cancelled"
          : (interview.feedback ? "Completed" : (interview.status || "Scheduled"));

        interviewRounds.push({
          id: interview.id,
          interviewId: interview.id,
          type: "interview",
          roundName: roundTitle,
          interviewer: interview.interviewer || "Rajesh Kumar",
          time: timePart,
          date: datePart,
          datetime: interview.datetime,
          mode: interview.mode || "Video",
          meetingLink: interview.meetingLink || row.meeting_link || "",
          venue: interview.venue || row.venue || "",
          status: effectiveStatus,
          inviteSent: interview.inviteSent !== undefined ? !!interview.inviteSent : true,
          inviteSentAt: interview.inviteSentAt || row.invite_sent_at || row.created_at || new Date().toISOString(),
          feedback: isCandidateRejected ? "" : (interview.feedback || ""),
          rating: isCandidateRejected ? 0 : (interview.rating || 0),
        });
      });
    }

    timeline.push(...interviewRounds);

    // Sync candidate stage to active interview round if candidate is in interview process
    const activeScheduledRound = interviewRounds.slice().reverse().find(r => r.status === "Scheduled");
    const latestRound = activeScheduledRound || interviewRounds[interviewRounds.length - 1];
    if (latestRound?.roundName && !["Offer", "Offer Acceptance", "Hired", "Rejected"].includes(candidate.stage)) {
      candidate.stage = latestRound.roundName;
      candidate.currentRound = latestRound.roundName;
    }

    // If any interview round is Completed or has feedback, append the 5 post-interview workflow stages
    const hasCompletedInterview = interviewRounds.some(
      (r) => r.status === "Completed" || (r.feedback && String(r.feedback).trim().length > 0)
    );

    const isDummyAssignee = (name) => {
      if (!name || typeof name !== "string") return false;
      const n = name.toLowerCase().trim();
      return (
        n.includes("priya menon") ||
        n.includes("kavitha s") ||
        n.includes("meera") ||
        n.includes("rajesh kumar") ||
        n.includes("anita singh") ||
        n.includes("suresh reddy") ||
        n.includes("deepika sen")
      );
    };

    let estEmployeeName = "";
    try {
      const candEstId = candidate.establishmentId || candidate.establishment_id;
      const empRes = await db.query(
        `SELECT name FROM public.ca_employees 
         WHERE (establishment_id = $1::integer OR $1 IS NULL) 
           AND (company_id = $2 OR $2 IS NULL) 
           AND (status IS NULL OR status != 'Inactive') 
         ORDER BY id ASC LIMIT 1`,
        [candEstId ? Number(candEstId) : null, companyId ? Number(companyId) : null]
      );
      if (empRes.rows[0]) {
        estEmployeeName = empRes.rows[0].name;
      }
    } catch (e) {}

    const defaultWorkflowStages = [
      {
        id: "workflow-doc-collection",
        type: "workflow",
        stageKey: "document_collection",
        title: "Document collection",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: true,
      },
      {
        id: "workflow-offer-gen",
        type: "workflow",
        stageKey: "offer_generated",
        title: "Offer generated",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: false,
      },
      {
        id: "workflow-offer-approval",
        type: "workflow",
        stageKey: "offer_approval",
        title: "Offer approval",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: false,
      },
      {
        id: "workflow-offer-release",
        type: "workflow",
        stageKey: "offer_release",
        title: "Offer release",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: false,
      },
      {
        id: "workflow-offer-acceptance",
        type: "workflow",
        stageKey: "offer_acceptance",
        title: "Offer acceptance",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: false,
      },
    ];

    // Check if an offer already exists for this candidate (ONLY by candidate_id for real candidates)
    let offer = null;
    const numCandId = Number(candidate.id);
    if (numCandId > 0) {
      try {
        const offRes = await db.query(
          `SELECT * FROM public.ca_offers 
           WHERE candidate_id = $1 
             AND (created_by_company_id = $2 OR $2 IS NULL) 
           ORDER BY id DESC LIMIT 1`,
          [numCandId, companyId]
        );
        if (offRes.rows[0]) {
          offer = mapCAOffer(offRes.rows[0]);
        }
      } catch (e) {
        // ignore
      }
    }

    if (!isCandidateRejected && (hasCompletedInterview || ['Offer', 'Offer Acceptance', 'Hired'].includes(candidate.stage) || offer)) {
      let savedStages = candidate.workflowStages || candidate.workflow_stages;
      if (typeof savedStages === "string") {
        try {
          savedStages = JSON.parse(savedStages);
        } catch (e) {
          savedStages = null;
        }
      }
      // Merge saved stages with default workflow stages & clean dummy assignees
      let stagesToAppend = defaultWorkflowStages.map((def) => {
        const found = savedStages && Array.isArray(savedStages)
          ? savedStages.find((s) => s.stageKey === def.stageKey)
          : null;
        if (found) {
          const item = { ...def, ...found };
          if (!item.assignedTo || isDummyAssignee(item.assignedTo)) {
            item.assignedTo = estEmployeeName;
          }
          return item;
        }
        return { ...def };
      });

      const isOfferAccepted = candidate.stage === 'Offer Acceptance' || candidate.stage === 'Hired';

      if (isOfferAccepted) {
        // ONLY candidates in Offer Acceptance or Hired stage have all workflow stages Completed!
        const acceptDate = (offer?.status === 'Accepted' && offer?.updatedAt)
          ? new Date(offer.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          : (offer?.sentOn || "16 Oct 2026");
        const offerDate = offer?.sentOn || "15 Oct 2026";
        stagesToAppend = stagesToAppend.map((s) => ({
          ...s,
          status: 'Completed',
          date: s.date || (s.stageKey === 'offer_acceptance' ? acceptDate : offerDate),
          canMarkDone: false,
        }));
        interviewRounds.forEach((r) => {
          if (r.status !== 'Completed') r.status = 'Completed';
        });
      } else {
        // Sequential progression:
        // A stage is only completed if it was explicitly marked Completed in DB.
        // The first stage that is 'Pending' gets canMarkDone = true.
        // All subsequent stages get canMarkDone = false.
        let firstPendingFound = false;
        stagesToAppend = stagesToAppend.map((s) => {
          if (s.status === 'Completed') {
            return {
              ...s,
              canMarkDone: false,
            };
          } else {
            const canMark = !firstPendingFound;
            firstPendingFound = true;
            return {
              ...s,
              status: 'Pending',
              date: null,
              canMarkDone: canMark,
            };
          }
        });
      }

      timeline.push(...stagesToAppend);
    }

    return { candidate, timeline, offer };
  },

  async updateWorkflowStep(id, companyId, payload) {
    await ensureTable();
    const { stageKey, status, assignedTo, date } = payload;
    let candidate = await this.findById(id, companyId);
    const numId = Number(id);

    let estEmployeeName = "";
    try {
      const candEstId = candidate?.establishmentId || candidate?.establishment_id;
      const empRes = await db.query(
        `SELECT name FROM public.ca_employees 
         WHERE (establishment_id = $1::integer OR $1 IS NULL) 
           AND (company_id = $2 OR $2 IS NULL) 
           AND (status IS NULL OR status != 'Inactive') 
         ORDER BY id ASC LIMIT 1`,
        [candEstId ? Number(candEstId) : null, companyId ? Number(companyId) : null]
      );
      if (empRes.rows[0]) {
        estEmployeeName = empRes.rows[0].name;
      }
    } catch (e) {}

    const isDummyAssignee = (name) => {
      if (!name || typeof name !== "string") return false;
      const n = name.toLowerCase().trim();
      return (
        n.includes("priya menon") ||
        n.includes("kavitha s") ||
        n.includes("meera") ||
        n.includes("rajesh kumar") ||
        n.includes("anita singh") ||
        n.includes("suresh reddy") ||
        n.includes("deepika sen")
      );
    };

    const defaultWorkflowStages = [
      {
        id: "workflow-doc-collection",
        type: "workflow",
        stageKey: "document_collection",
        title: "Document collection",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: true,
      },
      {
        id: "workflow-offer-gen",
        type: "workflow",
        stageKey: "offer_generated",
        title: "Offer generated",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: false,
      },
      {
        id: "workflow-offer-approval",
        type: "workflow",
        stageKey: "offer_approval",
        title: "Offer approval",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: false,
      },
      {
        id: "workflow-offer-release",
        type: "workflow",
        stageKey: "offer_release",
        title: "Offer release",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: false,
      },
      {
        id: "workflow-offer-acceptance",
        type: "workflow",
        stageKey: "offer_acceptance",
        title: "Offer acceptance",
        status: "Pending",
        assignedTo: estEmployeeName,
        canMarkDone: false,
      },
    ];

    const currentStages = (candidate?.workflowStages && candidate.workflowStages.length > 0)
      ? candidate.workflowStages.map((s) => ({
          ...s,
          assignedTo: (!s.assignedTo || isDummyAssignee(s.assignedTo)) ? estEmployeeName : s.assignedTo,
        }))
      : [...defaultWorkflowStages];

    const idx = currentStages.findIndex((s) => s.stageKey === stageKey || s.title?.toLowerCase() === stageKey?.toLowerCase());
    if (idx !== -1) {
      if (status) currentStages[idx].status = status;
      if (assignedTo) currentStages[idx].assignedTo = assignedTo;
      if (status === "Completed") {
        currentStages[idx].canMarkDone = false;
        currentStages[idx].date = date || payload.date || new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });
        if (idx + 1 < currentStages.length) {
          currentStages[idx + 1].canMarkDone = true;
        }
      } else if (status === "Pending") {
        delete currentStages[idx].date;
      }
    }

    if (numId > 0 && candidate) {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates SET workflow_stages = $1::jsonb, updated_at = NOW() 
         WHERE id = $2 AND (created_by_company_id = $3 OR created_by_company_id IS NULL OR $3 IS NULL) 
         RETURNING *`,
        [JSON.stringify(currentStages), numId, companyId ? Number(companyId) : null]
      );
      return rows[0] ? mapCACandidate(rows[0]) : candidate;
    }

    return { ...candidate, workflowStages: currentStages };
  },

  async updateOutcomeStatus(id, companyId, outcomeStatus, statusReason) {
    const numId = Number(id);
    let candidate = await this.findById(id, companyId);
    if (!candidate) {
      candidate = fallbackCandidates.find((c) => String(c.id) === String(id));
    }

    let mappedStage = candidate?.stage || "Interview";
    if (outcomeStatus === "Selected") {
      mappedStage = "Offer";
    } else if (outcomeStatus === "Rejected") {
      mappedStage = "Rejected";
    } else if (outcomeStatus === "On Hold") {
      mappedStage = "On Hold";
    }

    if (numId > 0) {
      // 1. Update candidate stage and notes in ca_candidates
      const { rows } = await db.query(
        `UPDATE public.ca_candidates 
         SET stage = $1, 
             notes = COALESCE(notes, '[]'::jsonb) || $2::jsonb,
             updated_at = NOW() 
         WHERE id = $3 AND (created_by_company_id = $4 OR created_by_company_id IS NULL)
         RETURNING *`,
        [
          mappedStage,
          JSON.stringify([{
            text: `Candidate status updated to ${outcomeStatus}${statusReason ? `: ${statusReason}` : ""}`,
            date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
            author: "Talent Acquisition",
          }]),
          numId,
          companyId
        ]
      );

      // 2. If Selected, create Offer record in ca_offers if it does not exist yet
      if (outcomeStatus === "Selected") {
        const c = rows[0] || candidate;
        const todayStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        await db.query(
          `INSERT INTO public.ca_offers (
            created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on
          )
          SELECT $1, $2, $3, $4, 'Pending Acceptance', '₹96,000/mo', '₹1,20,000', TO_CHAR(NOW() + INTERVAL '15 days', 'DD Mon YYYY'), $5
          WHERE NOT EXISTS (
            SELECT 1 FROM public.ca_offers WHERE candidate_id = $2 AND created_by_company_id = $1
          )`,
          [companyId, numId, c?.name || "Candidate", c?.role || "Software Engineer", todayStr]
        ).catch(() => {});
      }

      // 3. If there are active interviews in ca_interviews, update/freeze the latest one without creating new interviews
      await db.query(
        `UPDATE public.ca_interviews
         SET status = $1, 
             completed_round = $1,
             is_frozen = TRUE,
             status_reason = COALESCE($2, status_reason),
             updated_at = NOW()
         WHERE candidate_id = $3 AND created_by_company_id = $4 AND status = 'Scheduled'`,
        [outcomeStatus === "Rejected" ? "Cancelled" : outcomeStatus, statusReason || null, numId, companyId]
      ).catch(() => {});

      if (outcomeStatus === "Rejected") {
        await db.query(
          `DELETE FROM public.ca_offers WHERE candidate_id = $1 AND (created_by_company_id = $2 OR $2 IS NULL)`,
          [numId, companyId]
        ).catch(() => {});
        await db.query(
          `UPDATE public.ca_candidates SET workflow_stages = '[]'::jsonb WHERE id = $1`,
          [numId]
        ).catch(() => {});
      }

      if (rows[0]) {
        return mapCACandidate(rows[0]);
      }
    }

    return {
      ...candidate,
      stage: mappedStage,
      status: outcomeStatus,
    };
  },

  async getDocuments(id, companyId) {
    await ensureTable();
    const numId = Number(id);
    if (!isNaN(numId) && numId > 0) {
      const { rows } = await db.query(
        `SELECT documents FROM public.ca_candidates WHERE id = $1 AND (created_by_company_id = $2 OR $2 IS NULL) LIMIT 1`,
        [numId, companyId]
      );
      if (rows[0]?.documents) {
        let docs = rows[0].documents;
        if (typeof docs === "string") {
          try { docs = JSON.parse(docs); } catch { docs = []; }
        }
        return Array.isArray(docs) ? docs : [];
      }
    }
    return [];
  },

  async updateDocuments(id, companyId, documents) {
    await ensureTable();
    const docJson = JSON.stringify(Array.isArray(documents) ? documents : []);
    const numId = Number(id);
    if (!isNaN(numId) && numId > 0) {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates 
         SET documents = $2::jsonb, updated_at = NOW() 
         WHERE id = $1 AND (created_by_company_id = $3 OR $3 IS NULL)
         RETURNING *`,
        [numId, docJson, companyId]
      );

      // Automatically synchronize candidate documents to ca_offers if offer exists
      await db.query(
        `UPDATE public.ca_offers SET documents = $2::jsonb, updated_at = NOW() WHERE candidate_id = $1 AND (created_by_company_id = $3 OR $3 IS NULL)`,
        [numId, docJson, companyId]
      ).catch(() => {});

      // If document collection step exists in workflow_stages, mark it completed and unlock offer generation!
      if (rows[0]) {
        let stages = rows[0].workflow_stages;
        if (typeof stages === "string") {
          try { stages = JSON.parse(stages); } catch { stages = null; }
        }
        if (Array.isArray(stages) && stages.length > 0 && Array.isArray(documents) && documents.length > 0) {
          const todayStr = new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          const updatedStages = stages.map((st, idx) => {
            if (st.stageKey === "document_collection") {
              return { ...st, status: "Completed", date: st.date || todayStr, canMarkDone: false };
            }
            if (idx === 1 && stages[0]?.stageKey === "document_collection") {
              return { ...st, canMarkDone: true };
            }
            return st;
          });
          await db.query(
            `UPDATE public.ca_candidates SET workflow_stages = $2::jsonb, updated_at = NOW() WHERE id = $1`,
            [numId, JSON.stringify(updatedStages)]
          );
          rows[0].workflow_stages = updatedStages;
        }
        return mapCACandidate(rows[0]);
      }
    }
    return null;
  },

  async updateChecklist(id, companyId, checklist) {
    await ensureTable();
    const checklistJson = JSON.stringify(checklist || {});
    const numId = Number(id);
    if (!isNaN(numId) && numId > 0) {
      const { rows } = await db.query(
        `UPDATE public.ca_candidates 
         SET pre_joining_checklist = $2::jsonb, updated_at = NOW() 
         WHERE id = $1 AND (created_by_company_id = $3 OR $3 IS NULL)
         RETURNING *`,
        [numId, checklistJson, companyId]
      );
      return rows[0] ? mapCACandidate(rows[0]) : null;
    }
    return null;
  },
};
