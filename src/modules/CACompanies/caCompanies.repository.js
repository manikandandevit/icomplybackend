import { db } from "../../core/db/pool.js";
import { caCompaniesAlterSql, caCompaniesIndexSql, caCompaniesTableSql, initialsFrom, mapCACompany } from "./caCompanies.constants.js";

let ready = null;

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const parseCountryId = (value) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caCompaniesTableSql);
      for (const statement of caCompaniesAlterSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
      for (const statement of caCompaniesIndexSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }

  return ready;
};

const selectColumns = `
  id, legal_name, trade_name, pan, gstin, street, city, state, pin, address_country_id,
  contact_name, email, mobile, logo_url, initials, accent, status,
  created_by_company_id, created_by_company_name, created_at
`;

export const caCompaniesRepository = {
  async listByCreator(createdByCompanyId) {
    const creatorId = parseRowId(createdByCompanyId);

    if (!creatorId) {
      return [];
    }

    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_companies
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [creatorId]
    );

    return rows.map(mapCACompany);
  },

  async findById(id) {
    const rowId = parseRowId(id);

    if (!rowId) {
      return null;
    }

    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_companies
      WHERE id = $1
      LIMIT 1
      `,
      [rowId]
    );

    return rows[0] ? mapCACompany(rows[0]) : null;
  },

  async findByPan(pan, excludeId) {
    await ensureTable();
    const excluded = parseRowId(excludeId);
    const { rows } = await db.query(
      excluded
        ? `
          SELECT id
          FROM public.ca_companies
          WHERE lower(pan) = lower($1) AND id <> $2
          LIMIT 1
          `
        : `
          SELECT id
          FROM public.ca_companies
          WHERE lower(pan) = lower($1)
          LIMIT 1
          `,
      excluded ? [pan, excluded] : [pan]
    );

    return rows[0] ?? null;
  },

  async findLogoKey(id) {
    const rowId = parseRowId(id);

    if (!rowId) {
      return null;
    }

    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT logo_url
      FROM public.ca_companies
      WHERE id = $1
      LIMIT 1
      `,
      [rowId]
    );

    return rows[0]?.logo_url ?? null;
  },

  async create(payload) {
    await ensureTable();
    const initials = payload.initials || initialsFrom(payload.legalName, payload.tradeName);
    const { rows } = await db.query(
      `
      INSERT INTO public.ca_companies (
        legal_name, trade_name, pan, gstin, street, city, state, pin, address_country_id,
        contact_name, email, mobile, initials, logo_url, status,
        created_by_company_id, created_by_company_name
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, 'Inactive',
        $15, $16
      )
      RETURNING *
      `,
      [
        payload.legalName,
        payload.tradeName,
        payload.pan,
        payload.gstin,
        payload.street,
        payload.city,
        payload.state,
        payload.pin,
        parseCountryId(payload.addressCountryId),
        payload.contactName,
        payload.email,
        payload.mobile,
        initials,
        payload.logoUrl,
        payload.createdByCompanyId,
        payload.createdByCompanyName,
      ]
    );

    return mapCACompany(rows[0]);
  },

  async update(id, payload) {
    const rowId = parseRowId(id);

    if (!rowId) {
      return null;
    }

    await ensureTable();
    const initials = payload.initials || initialsFrom(payload.legalName, payload.tradeName);
    const { rows } = await db.query(
      `
      UPDATE public.ca_companies SET
        legal_name = $2,
        trade_name = $3,
        pan = $4,
        gstin = $5,
        street = $6,
        city = $7,
        state = $8,
        pin = $9,
        address_country_id = $10,
        contact_name = $11,
        email = $12,
        mobile = $13,
        initials = $14,
        logo_url = COALESCE($15, logo_url)
      WHERE id = $1
      RETURNING *
      `,
      [
        rowId,
        payload.legalName,
        payload.tradeName,
        payload.pan,
        payload.gstin,
        payload.street,
        payload.city,
        payload.state,
        payload.pin,
        parseCountryId(payload.addressCountryId),
        payload.contactName,
        payload.email,
        payload.mobile,
        initials,
        payload.logoUrl ?? null,
      ]
    );

    return rows[0] ? mapCACompany(rows[0]) : null;
  },

  async updateStatus(id, status) {
    const rowId = parseRowId(id);

    if (!rowId) {
      return null;
    }

    await ensureTable();
    const { rows } = await db.query(
      `
      UPDATE public.ca_companies
      SET status = $2
      WHERE id = $1
      RETURNING *
      `,
      [rowId, status]
    );

    return rows[0] ? mapCACompany(rows[0]) : null;
  },
};
