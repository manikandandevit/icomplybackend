import { db } from "../../core/db/pool.js";

export const caFcmTokensTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_fcm_tokens (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  token TEXT NOT NULL UNIQUE,
  device_type TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ca_in_app_notifications (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  target_user_type TEXT NOT NULL,
  target_user_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caFcmTokensIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_fcm_tokens_company
  ON public.ca_fcm_tokens (company_id);
CREATE INDEX IF NOT EXISTS idx_ca_fcm_tokens_user
  ON public.ca_fcm_tokens (user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_ca_fcm_tokens_token
  ON public.ca_fcm_tokens (token);
CREATE INDEX IF NOT EXISTS idx_ca_in_app_notif_target
  ON public.ca_in_app_notifications (company_id, target_user_type, is_read);
`;

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caFcmTokensTableSql);
      for (const statement of caFcmTokensIndexSql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }
  return ready;
};

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const caFcmRepository = {
  async saveToken({ companyId, userType, userId, userEmail, token, deviceType = "web" }) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid || !token || !userType || !userId) return null;

    const query = `
      INSERT INTO public.ca_fcm_tokens (
        company_id, user_type, user_id, user_email, token, device_type, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (token) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        user_type = EXCLUDED.user_type,
        user_id = EXCLUDED.user_id,
        user_email = EXCLUDED.user_email,
        device_type = EXCLUDED.device_type,
        updated_at = NOW()
      RETURNING *;
    `;

    const { rows } = await db.query(query, [
      cid,
      String(userType),
      String(userId),
      userEmail ? String(userEmail) : null,
      String(token).trim(),
      String(deviceType || "web"),
    ]);

    return rows[0] || null;
  },

  async removeToken(token) {
    await ensureTable();
    if (!token) return 0;
    const { rowCount } = await db.query(
      `DELETE FROM public.ca_fcm_tokens WHERE token = $1`,
      [String(token).trim()]
    );
    return rowCount;
  },

  async deleteTokens(tokens = []) {
    await ensureTable();
    if (!tokens.length) return 0;
    const { rowCount } = await db.query(
      `DELETE FROM public.ca_fcm_tokens WHERE token = ANY($1::text[])`,
      [tokens]
    );
    return rowCount;
  },

  async getAdminTokens(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    const { rows } = await db.query(
      `
      SELECT token
      FROM public.ca_fcm_tokens
      WHERE company_id = $1 AND user_type IN ('company', 'ca_user')
      `,
      [cid]
    );

    return rows.map((r) => r.token).filter(Boolean);
  },

  async getEmployeeTokens(companyId, employeeId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid || !employeeId) return [];

    const { rows } = await db.query(
      `
      SELECT token
      FROM public.ca_fcm_tokens
      WHERE company_id = $1 AND user_type = 'employee' AND user_id = $2
      `,
      [cid, String(employeeId)]
    );

    return rows.map((r) => r.token).filter(Boolean);
  },

  async saveInAppNotification({ companyId, targetUserType, targetUserId = null, title, body, data = {} }) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid || !title || !body) return null;

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_in_app_notifications (
        company_id, target_user_type, target_user_id, title, body, data
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [cid, String(targetUserType), targetUserId ? String(targetUserId) : null, title, body, JSON.stringify(data)]
    );

    return rows[0] || null;
  },

  async getUnreadInAppNotifications({ companyId, userType, userId = null }) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    const targetType = userType === "employee" ? "employee" : "admin";
    let query = `
      SELECT id, company_id, target_user_type, target_user_id, title, body, data, created_at
      FROM public.ca_in_app_notifications
      WHERE company_id = $1 AND target_user_type = $2 AND is_read = FALSE
    `;
    const params = [cid, targetType];

    if (targetType === "employee" && userId) {
      query += ` AND (target_user_id = $3 OR target_user_id IS NULL)`;
      params.push(String(userId));
    }

    query += ` ORDER BY id DESC LIMIT 5`;

    const { rows } = await db.query(query, params);
    return rows;
  },

  async markInAppNotificationRead(id, companyId) {
    await ensureTable();
    const nid = parseRowId(id);
    const cid = parseRowId(companyId);
    if (!nid || !cid) return 0;

    const { rowCount } = await db.query(
      `UPDATE public.ca_in_app_notifications SET is_read = TRUE WHERE id = $1 AND company_id = $2`,
      [nid, cid]
    );
    return rowCount;
  },
};
