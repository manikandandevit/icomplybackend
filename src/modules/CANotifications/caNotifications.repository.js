import { db } from "../../core/db/pool.js";
import {
  caNotificationSettingsTableSql,
  caNotificationSettingsIndexSql,
  getDefaultSettings,
} from "./caNotifications.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caNotificationSettingsTableSql);
      for (const statement of caNotificationSettingsIndexSql
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

export const caNotificationsRepository = {
  async getSettings(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;

    const { rows } = await db.query(
      `
      SELECT id, company_id, channels, notifications, templates, created_at, updated_at
      FROM public.ca_notification_settings
      WHERE company_id = $1
      LIMIT 1
      `,
      [cid]
    );

    if (rows.length > 0) {
      return {
        id: rows[0].id,
        companyId: rows[0].company_id,
        channels: typeof rows[0].channels === "string" ? JSON.parse(rows[0].channels) : rows[0].channels,
        notifications: typeof rows[0].notifications === "string" ? JSON.parse(rows[0].notifications) : rows[0].notifications,
        templates: typeof rows[0].templates === "string" ? JSON.parse(rows[0].templates) : rows[0].templates,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
      };
    }

    // Initialize defaults if not present
    const defaults = getDefaultSettings();
    const insertRes = await db.query(
      `
      INSERT INTO public.ca_notification_settings (company_id, channels, notifications, templates)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (company_id) DO UPDATE SET updated_at = NOW()
      RETURNING id, company_id, channels, notifications, templates, created_at, updated_at
      `,
      [cid, JSON.stringify(defaults.channels), JSON.stringify(defaults.notifications), JSON.stringify(defaults.templates)]
    );

    const row = insertRes.rows[0];
    return {
      id: row.id,
      companyId: row.company_id,
      channels: typeof row.channels === "string" ? JSON.parse(row.channels) : row.channels,
      notifications: typeof row.notifications === "string" ? JSON.parse(row.notifications) : row.notifications,
      templates: typeof row.templates === "string" ? JSON.parse(row.templates) : row.templates,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async saveSettings(companyId, { channels, notifications, templates }) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;

    const current = await this.getSettings(cid);

    const mergedChannels = channels !== undefined ? channels : current.channels;
    const mergedNotifications = notifications !== undefined ? notifications : current.notifications;
    const mergedTemplates = templates !== undefined ? templates : current.templates;

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_notification_settings (company_id, channels, notifications, templates, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (company_id) DO UPDATE SET
        channels = EXCLUDED.channels,
        notifications = EXCLUDED.notifications,
        templates = EXCLUDED.templates,
        updated_at = NOW()
      RETURNING id, company_id, channels, notifications, templates, created_at, updated_at
      `,
      [
        cid,
        JSON.stringify(mergedChannels),
        JSON.stringify(mergedNotifications),
        JSON.stringify(mergedTemplates),
      ]
    );

    const row = rows[0];
    return {
      id: row.id,
      companyId: row.company_id,
      channels: typeof row.channels === "string" ? JSON.parse(row.channels) : row.channels,
      notifications: typeof row.notifications === "string" ? JSON.parse(row.notifications) : row.notifications,
      templates: typeof row.templates === "string" ? JSON.parse(row.templates) : row.templates,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async resetSettings(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;

    const defaults = getDefaultSettings();
    const { rows } = await db.query(
      `
      INSERT INTO public.ca_notification_settings (company_id, channels, notifications, templates, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (company_id) DO UPDATE SET
        channels = EXCLUDED.channels,
        notifications = EXCLUDED.notifications,
        templates = EXCLUDED.templates,
        updated_at = NOW()
      RETURNING id, company_id, channels, notifications, templates, created_at, updated_at
      `,
      [
        cid,
        JSON.stringify(defaults.channels),
        JSON.stringify(defaults.notifications),
        JSON.stringify(defaults.templates),
      ]
    );

    const row = rows[0];
    return {
      id: row.id,
      companyId: row.company_id,
      channels: typeof row.channels === "string" ? JSON.parse(row.channels) : row.channels,
      notifications: typeof row.notifications === "string" ? JSON.parse(row.notifications) : row.notifications,
      templates: typeof row.templates === "string" ? JSON.parse(row.templates) : row.templates,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async updateTemplate(companyId, key, templateData) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return null;

    const current = await this.getSettings(cid);
    const updatedTemplates = {
      ...current.templates,
      [key]: {
        ...(current.templates[key] || {}),
        ...templateData,
      },
    };

    return this.saveSettings(cid, { templates: updatedTemplates });
  },
};
