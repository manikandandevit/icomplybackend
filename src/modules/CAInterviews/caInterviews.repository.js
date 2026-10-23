import { db } from "../../core/db/pool.js";
import { caInterviewsTableSql, mapCAInterview } from "./caInterviews.constants.js";

let ready = null;
const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caInterviewsTableSql);
    })();
  }
  return ready;
};

export const caInterviewsRepository = {
  async list(companyId) {
    await ensureTable();


    const { rows } = await db.query(
      `SELECT i.*, c.name as candidate_name, c.email as candidate_email FROM public.ca_interviews i LEFT JOIN public.ca_candidates c ON i.candidate_id = c.id WHERE i.created_by_company_id = $1 ORDER BY i.id DESC`,
      [companyId]
    );
    return rows.map(r => ({ ...mapCAInterview(r), candidate: r.candidate_name, email: r.candidate_email }));
  },

  async create(companyId, payload) {
    await ensureTable();
    const isInviteSent = !!payload.inviteSent;
    const meetingLink = payload.meetingLink || payload.meeting_link || null;
    const venue = payload.venue || null;
    const { rows } = await db.query(
      `INSERT INTO public.ca_interviews (
        created_by_company_id, candidate_id, role, interviewer, type, datetime, mode, status, invite_sent, invite_sent_at, round_name, meeting_link, venue
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9 THEN NOW() ELSE NULL END, $10, $11, $12) RETURNING *`,
      [
        companyId, payload.candidateId, payload.role, payload.interviewer, payload.type, payload.datetime, payload.mode, payload.status || 'Scheduled', isInviteSent, payload.roundName || payload.type || null, meetingLink, venue
      ]
    );
    return mapCAInterview(rows[0]);
  },

  async update(id, companyId, payload) {
    await ensureTable();
    const numId = Number(id);
    if (numId > 0) {
      const meetingLink = payload.meetingLink !== undefined ? payload.meetingLink : (payload.meeting_link !== undefined ? payload.meeting_link : null);
      const venue = payload.venue !== undefined ? payload.venue : null;
      const { rows } = await db.query(
        `UPDATE public.ca_interviews 
         SET candidate_id = COALESCE($1, candidate_id),
             role = COALESCE($2, role),
             interviewer = COALESCE($3, interviewer),
             type = COALESCE($4, type),
             datetime = COALESCE($5, datetime),
             mode = COALESCE($6, mode),
             meeting_link = COALESCE($7, meeting_link),
             venue = COALESCE($8, venue)
         WHERE id = $9 AND created_by_company_id = $10
         RETURNING *`,
        [
          payload.candidateId || null,
          payload.role || null,
          payload.interviewer || null,
          payload.type || null,
          payload.datetime || null,
          payload.mode || null,
          meetingLink,
          venue,
          numId,
          companyId
        ]
      );
      if (rows[0]) {
        const updated = mapCAInterview(rows[0]);
        const candRes = await db.query(`SELECT name FROM public.ca_candidates WHERE id = $1`, [updated.candidateId]);
        return { ...updated, candidate: candRes.rows[0]?.name || 'Candidate' };
      }
    }
    return null;
  },

  async updateStatus(id, companyId, status) {
    await ensureTable();
    const numId = Number(id);

    // 1. If positive ID, update only that specific interview ID
    if (numId > 0) {
      const { rows } = await db.query(
        `UPDATE public.ca_interviews SET status = $1, is_frozen = FALSE 
         WHERE id = $2 AND created_by_company_id = $3 
         RETURNING *`,
        [status, numId, companyId]
      );

      if (rows[0]) {
        const updated = mapCAInterview(rows[0]);
        if (status === 'Selected' && updated.candidateId) {
          await db.query(
            `UPDATE public.ca_candidates SET stage = 'Offer' WHERE id = $1 AND created_by_company_id = $2`,
            [updated.candidateId, companyId]
          );
        } else if (status === 'Rejected' && updated.candidateId) {
          await db.query(
            `UPDATE public.ca_candidates SET stage = 'Rejected' WHERE id = $1 AND created_by_company_id = $2`,
            [updated.candidateId, companyId]
          );
        }
        const candRes = await db.query(`SELECT name FROM public.ca_candidates WHERE id = $1`, [updated.candidateId]);
        return { ...updated, candidate: candRes.rows[0]?.name || 'Candidate' };
      }
    }

    // 2. If negative ID (dummy rows -1..-5)
    const absId = Math.abs(numId);
    const defaults = {
      1: { candidate: "Arjun Mehta", role: "Senior Software Engineer", interviewer: "Rajesh Kumar", type: "Technical", datetime: "16 Sep 2026 · 10:00 AM", mode: "Video" },
      2: { candidate: "Priya Sharma", role: "Product Manager", interviewer: "Anita Singh", type: "HR", datetime: "16 Sep 2026 · 2:00 PM", mode: "In-Person" },
      3: { candidate: "Neha Gupta", role: "Data Analyst", interviewer: "Suresh Reddy", type: "Technical", datetime: "17 Sep 2026 · 11:00 AM", mode: "Video" },
      4: { candidate: "Vikram Reddy", role: "Senior Software Engineer", interviewer: "Rajesh Kumar", type: "Technical", datetime: "15 Sep 2026 · 3:00 PM", mode: "Video" },
      5: { candidate: "Rahul Singh", role: "DevOps Engineer", interviewer: "Kiran Bose", type: "Managerial", datetime: "15 Sep 2026 · 4:30 PM", mode: "Video" }
    };
    const def = defaults[absId];
    if (def) {
      let candId = 0;
      const cRes = await db.query(
        `SELECT id FROM public.ca_candidates WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND created_by_company_id = $2 LIMIT 1`,
        [def.candidate, companyId]
      );
      if (cRes.rows[0]) {
        candId = cRes.rows[0].id;
        if (status === 'Selected') {
          await db.query(`UPDATE public.ca_candidates SET stage = 'Offer' WHERE id = $1`, [candId]);
        }
      } else {
        const initials = def.candidate
          .split(' ')
          .map(w => w[0])
          .join('')
          .slice(0, 4)
          .toUpperCase() || 'NA';
        const todayStr = new Date().toLocaleDateString('en-GB');
        const newC = await db.query(
          `INSERT INTO public.ca_candidates (
            created_by_company_id, name, initials, details, role, match, stage, source, applied
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            companyId,
            def.candidate,
            initials,
            'Experienced Candidate',
            def.role,
            85,
            status === 'Selected' ? 'Offer' : 'Interview',
            'Direct',
            todayStr
          ]
        );
        candId = newC.rows[0].id;
      }

      // Check if this candidate already has an interview in DB
      const existingInt = await db.query(
        `SELECT id FROM public.ca_interviews WHERE candidate_id = $1 AND created_by_company_id = $2 LIMIT 1`,
        [candId, companyId]
      );
      if (existingInt.rows[0]) {
        const upd = await db.query(
          `UPDATE public.ca_interviews SET status = $1, is_frozen = FALSE WHERE id = $2 RETURNING *`,
          [status, existingInt.rows[0].id]
        );
        return { ...mapCAInterview(upd.rows[0]), candidate: def.candidate };
      }

      const ins = await db.query(
        `INSERT INTO public.ca_interviews (created_by_company_id, candidate_id, role, interviewer, type, datetime, mode, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [companyId, candId, def.role, def.interviewer, def.type, def.datetime, def.mode, status]
      );
      return { ...mapCAInterview(ins.rows[0]), candidate: def.candidate };
    }
    return null;
  },

  async submitFeedback(id, companyId, { rating, feedback, outcomeStatus, statusReason, roundsCompleted, completedRound }) {
    await ensureTable();
    const finalStatus = outcomeStatus || (rating >= 3 ? 'Selected' : 'Rejected');
    const numId = Number(id);

    let roundText = completedRound;
    if (!roundText) {
      if (finalStatus === "First Round Shortlisted") {
        roundText = "First Round Completed";
      } else if (finalStatus === "Second Round Shortlisted") {
        roundText = "Second Round Completed";
      } else if (finalStatus === "Final Round Shortlisted") {
        roundText = "Second Round Completed";
      } else if (finalStatus === "HR Round") {
        roundText = "Final Round Completed";
      } else if (finalStatus === "Selected") {
        roundText = "All Rounds Completed";
      } else if (roundsCompleted === 1) {
        roundText = "First Round Completed";
      } else if (roundsCompleted === 2) {
        roundText = "Second Round Completed";
      } else {
        roundText = "";
      }
    }

    const numRounds = roundsCompleted !== undefined 
      ? Number(roundsCompleted) 
      : (finalStatus === "First Round Shortlisted" ? 1 : (finalStatus === "Second Round Shortlisted" || finalStatus === "Final Round Shortlisted") ? 2 : (finalStatus === "HR Round" || finalStatus === "Selected") ? 3 : 1);

    if (numId > 0) {
      const { rows } = await db.query(
        `UPDATE public.ca_interviews 
         SET rating = $1, feedback = $2, status_reason = $3, rounds_completed = $4, completed_round = $9, is_frozen = TRUE, status = $5,
             feedback_history = COALESCE(feedback_history, '[]'::jsonb) || $8::jsonb
         WHERE id = $6 AND created_by_company_id = $7 
         RETURNING *`,
        [rating, feedback, statusReason || null, numRounds, finalStatus, numId, companyId, JSON.stringify([{ round: finalStatus, rating, feedback, reason: statusReason, roundsCompleted: numRounds, completedRound: roundText, date: new Date().toLocaleDateString('en-GB') }]), roundText]
      );

      if (rows[0]) {
        const updated = mapCAInterview(rows[0]);
        if (finalStatus === 'Selected' && updated.candidateId) {
          await db.query(
            `UPDATE public.ca_candidates SET stage = 'Offer', updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2`,
            [updated.candidateId, companyId]
          );
          const candRow = await db.query(`SELECT * FROM public.ca_candidates WHERE id = $1`, [updated.candidateId]);
          if (candRow.rows[0]) {
            const c = candRow.rows[0];
            const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            await db.query(
              `INSERT INTO public.ca_offers (
                created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on
              )
              SELECT $1, $2, $3, $4, 'Pending Acceptance', '₹96,000/mo', '₹1,20,000', TO_CHAR(NOW() + INTERVAL '15 days', 'DD Mon YYYY'), $5
              WHERE NOT EXISTS (
                SELECT 1 FROM public.ca_offers WHERE candidate_id = $2 AND created_by_company_id = $1
              )`,
              [companyId, c.id, c.name, c.role || 'Software Engineer', todayStr]
            );
          }
        } else if (finalStatus === 'Rejected' && updated.candidateId) {
          await db.query(
            `UPDATE public.ca_candidates SET stage = 'Rejected' WHERE id = $1 AND created_by_company_id = $2`,
            [updated.candidateId, companyId]
          );
        }
        if (updated.candidateId) {
          await db.query(`
            UPDATE public.ca_candidates
            SET workflow_stages = COALESCE(
              NULLIF(workflow_stages, '[]'::jsonb),
              $1::jsonb
            ), updated_at = NOW()
            WHERE id = $2
          `, [JSON.stringify([
            { id: "workflow-doc-collection", type: "workflow", stageKey: "document_collection", title: "Document collection", status: "Pending", assignedTo: "Priya Menon (HR Manager)", canMarkDone: true },
            { id: "workflow-offer-gen", type: "workflow", stageKey: "offer_generated", title: "Offer generated", status: "Pending", assignedTo: "Priya Menon (HR Manager)", canMarkDone: false },
            { id: "workflow-offer-approval", type: "workflow", stageKey: "offer_approval", title: "Offer approval", status: "Pending", assignedTo: "Kavitha S (Finance Head)", canMarkDone: false },
            { id: "workflow-offer-release", type: "workflow", stageKey: "offer_release", title: "Offer release", status: "Pending", assignedTo: "Priya Menon (HR Manager)", canMarkDone: false },
            { id: "workflow-offer-acceptance", type: "workflow", stageKey: "offer_acceptance", title: "Offer acceptance", status: "Pending", assignedTo: "Priya Menon (HR Manager)", canMarkDone: false }
          ]), updated.candidateId]);
        }

        const candRes = await db.query(`SELECT name FROM public.ca_candidates WHERE id = $1`, [updated.candidateId]);
        return { ...updated, candidate: candRes.rows[0]?.name || 'Candidate' };
      }
    }

    // If dummy ID or not found in DB, upsert as frozen record
    const { candidateId: payloadCandidateId } = payload;
    const absId = Math.abs(numId) || 1;
    const defaults = {
      1: { candidate: "Arjun Mehta", role: "Senior Software Engineer", interviewer: "Rajesh Kumar", type: "Technical", datetime: "16 Sep 2026 · 10:00 AM", mode: "Video" },
      2: { candidate: "Priya Sharma", role: "Product Manager", interviewer: "Anita Singh", type: "HR", datetime: "16 Sep 2026 · 2:00 PM", mode: "In-Person" },
      3: { candidate: "Neha Gupta", role: "Data Analyst", interviewer: "Suresh Reddy", type: "Technical", datetime: "17 Sep 2026 · 11:00 AM", mode: "Video" },
      4: { candidate: "Vikram Reddy", role: "Senior Software Engineer", interviewer: "Rajesh Kumar", type: "Technical", datetime: "15 Sep 2026 · 3:00 PM", mode: "Video" },
      5: { candidate: "Rahul Singh", role: "DevOps Engineer", interviewer: "Kiran Bose", type: "Managerial", datetime: "15 Sep 2026 · 4:30 PM", mode: "Video" }
    };
    const def = defaults[absId] || defaults[1];
    let candId = 0;

    if (payloadCandidateId && Number(payloadCandidateId) > 0) {
      const cLookup = await db.query(
        `SELECT * FROM public.ca_candidates WHERE id = $1 AND (created_by_company_id = $2 OR $2 IS NULL) LIMIT 1`,
        [Number(payloadCandidateId), companyId]
      );
      if (cLookup.rows[0]) {
        candId = cLookup.rows[0].id;
        def.candidate = cLookup.rows[0].name;
        def.role = cLookup.rows[0].role || def.role;
      }
    }

    if (!candId) {
      const cRes = await db.query(
        `SELECT id FROM public.ca_candidates WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND created_by_company_id = $2 LIMIT 1`,
        [def.candidate, companyId]
      );
      if (cRes.rows[0]) {
        candId = cRes.rows[0].id;
      }
    }

    if (candId) {
      if (finalStatus === 'Selected') {
        await db.query(`UPDATE public.ca_candidates SET stage = 'Offer', updated_at = NOW() WHERE id = $1`, [candId]);
        const candRow = await db.query(`SELECT * FROM public.ca_candidates WHERE id = $1`, [candId]);
        if (candRow.rows[0]) {
          const c = candRow.rows[0];
          const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          await db.query(
            `INSERT INTO public.ca_offers (
              created_by_company_id, candidate_id, candidate_name, role, status, ctc, joining_bonus, joining_date, sent_on
            )
            SELECT $1, $2, $3, $4, 'Pending Acceptance', '₹96,000/mo', '₹1,20,000', TO_CHAR(NOW() + INTERVAL '15 days', 'DD Mon YYYY'), $5
            WHERE NOT EXISTS (
              SELECT 1 FROM public.ca_offers WHERE candidate_id = $2 AND created_by_company_id = $1
            )`,
            [companyId, c.id, c.name, c.role || 'Software Engineer', todayStr]
          );
        }
      } else if (finalStatus === 'Rejected') {
        await db.query(`UPDATE public.ca_candidates SET stage = 'Rejected' WHERE id = $1`, [candId]);
      }
    } else {
      const initials = def.candidate
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 4)
        .toUpperCase() || 'NA';
      const todayStr = new Date().toLocaleDateString('en-GB');
      const newC = await db.query(
        `INSERT INTO public.ca_candidates (
          created_by_company_id, name, initials, details, role, match, stage, source, applied
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          companyId,
          def.candidate,
          initials,
          'Experienced Candidate',
          def.role,
          85,
          finalStatus === 'Selected' ? 'Offer' : 'Interview',
          'Direct',
          todayStr
        ]
      );
      candId = newC.rows[0].id;
    }

    // Initialize workflow stages on candidate if not set
    if (candId) {
      await db.query(`
        UPDATE public.ca_candidates
        SET workflow_stages = COALESCE(
          NULLIF(workflow_stages, '[]'::jsonb),
          $1::jsonb
        ), updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify([
        { id: "workflow-doc-collection", type: "workflow", stageKey: "document_collection", title: "Document collection", status: "Pending", assignedTo: "Priya Menon (HR Manager)", canMarkDone: true },
        { id: "workflow-offer-gen", type: "workflow", stageKey: "offer_generated", title: "Offer generated", status: "Pending", assignedTo: "Priya Menon (HR Manager)", canMarkDone: false },
        { id: "workflow-offer-approval", type: "workflow", stageKey: "offer_approval", title: "Offer approval", status: "Pending", assignedTo: "Kavitha S (Finance Head)", canMarkDone: false },
        { id: "workflow-offer-release", type: "workflow", stageKey: "offer_release", title: "Offer release", status: "Pending", assignedTo: "Priya Menon (HR Manager)", canMarkDone: false },
        { id: "workflow-offer-acceptance", type: "workflow", stageKey: "offer_acceptance", title: "Offer acceptance", status: "Pending", assignedTo: "Priya Menon (HR Manager)", canMarkDone: false }
      ]), candId]);
    }

    // Check if this candidate already has an interview in DB
    const existingInt = await db.query(
      `SELECT id FROM public.ca_interviews WHERE candidate_id = $1 AND created_by_company_id = $2 LIMIT 1`,
      [candId, companyId]
    );
    if (existingInt.rows[0]) {
      const upd = await db.query(
        `UPDATE public.ca_interviews 
         SET rating = $1, feedback = $2, status_reason = $3, rounds_completed = $4, completed_round = $8, is_frozen = TRUE, status = $5,
             feedback_history = COALESCE(feedback_history, '[]'::jsonb) || $7::jsonb
         WHERE id = $6 RETURNING *`,
        [rating, feedback, statusReason || null, numRounds, finalStatus, existingInt.rows[0].id, JSON.stringify([{ round: finalStatus, rating, feedback, reason: statusReason, roundsCompleted: numRounds, completedRound: roundText, date: new Date().toLocaleDateString('en-GB') }]), roundText]
      );
      return { ...mapCAInterview(upd.rows[0]), candidate: def.candidate };
    }

    const ins = await db.query(
      `INSERT INTO public.ca_interviews (created_by_company_id, candidate_id, role, interviewer, type, datetime, mode, status, rating, feedback, status_reason, rounds_completed, completed_round, is_frozen, feedback_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, $14) RETURNING *`,
      [companyId, candId, def.role, def.interviewer, def.type, def.datetime, def.mode, finalStatus, rating, feedback, statusReason || null, numRounds, roundText, JSON.stringify([{ round: finalStatus, rating, feedback, reason: statusReason, roundsCompleted: numRounds, completedRound: roundText, date: new Date().toLocaleDateString('en-GB') }])]
    );
    return { ...mapCAInterview(ins.rows[0]), candidate: def.candidate };
  },

  async sendInvite(id, companyId) {
    await ensureTable();
    const numId = Number(id);
    if (numId > 0) {
      let { rows } = await db.query(
        `UPDATE public.ca_interviews 
         SET invite_sent = TRUE, invite_sent_at = NOW() 
         WHERE id = $1 AND ($2::int IS NULL OR created_by_company_id = $2::int)
         RETURNING *`,
        [numId, companyId || null]
      );
      if (!rows[0]) {
        const fallback = await db.query(
          `UPDATE public.ca_interviews 
           SET invite_sent = TRUE, invite_sent_at = NOW() 
           WHERE id = $1
           RETURNING *`,
          [numId]
        );
        rows = fallback.rows;
      }
      if (rows[0]) {
        return mapCAInterview(rows[0]);
      }
    }
    return { id: numId, inviteSent: true, inviteSentAt: new Date().toISOString() };
  },

  async delete(id, companyId) {
    await ensureTable();
    const res = await db.query(
      `DELETE FROM public.ca_interviews WHERE id = $1 AND created_by_company_id = $2 RETURNING id`,
      [Number(id), companyId]
    );
    return res.rows[0] ? true : false;
  }
};

