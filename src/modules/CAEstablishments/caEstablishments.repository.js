import { db } from "../../core/db/pool.js";
import {
  caEstablishmentsIndexSql,
  caEstablishmentsTableSql,
  mapEstablishment,
} from "./caEstablishments.constants.js";

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
      await db.query(caEstablishmentsTableSql);
      for (const statement of caEstablishmentsIndexSql
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
  id, name, type, status, company_id, company_source, company_name, country_id, country_name,
  effective_date, employee_count, nature_of_work, address, city, state, pin,
  pf_code, pf_status, esi_applicable, esi_code, lwf_code, pt_reg_no, pt_state,
  contact_name, email, mobile, created_by_company_id, created_at
`;

const writeValues = (payload) => [
  payload.name,
  payload.type,
  payload.status,
  parseRowId(payload.companyId),
  payload.companySource,
  payload.companyName,
  parseCountryId(payload.countryId),
  payload.countryName || null,
  payload.effectiveDate || null,
  payload.employeeCount,
  payload.natureOfWork || null,
  payload.address,
  payload.city,
  payload.state,
  payload.pin,
  payload.pfCode,
  payload.pfStatus || null,
  payload.esiApplicable,
  payload.esiCode || null,
  payload.lwfCode || null,
  payload.ptRegNo || null,
  payload.ptState || null,
  payload.contactName,
  payload.email,
  payload.mobile,
];

export const caEstablishmentsRepository = {
  async listByCreator(createdByCompanyId) {
    const creatorId = parseRowId(createdByCompanyId);

    if (!creatorId) {
      return [];
    }

    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT ${selectColumns}
      FROM public.ca_establishments
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [creatorId]
    );

    return rows.map(mapEstablishment);
  },

  async countsByCreator(createdByCompanyId) {
    const creatorId = parseRowId(createdByCompanyId);

    if (!creatorId) {
      return {};
    }

    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT company_source, company_id, COUNT(*)::int AS count
      FROM public.ca_establishments
      WHERE created_by_company_id = $1
      GROUP BY company_source, company_id
      `,
      [creatorId]
    );

    return Object.fromEntries(
      rows.map((row) => [`${row.company_source === "ca" ? "ca" : "parent"}:${row.company_id}`, Number(row.count) || 0])
    );
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
      FROM public.ca_establishments
      WHERE id = $1
      LIMIT 1
      `,
      [rowId]
    );

    return rows[0] ? mapEstablishment(rows[0]) : null;
  },

  async create(payload) {
    await ensureTable();
    const { rows } = await db.query(
      `
      INSERT INTO public.ca_establishments (
        name, type, status, company_id, company_source, company_name, country_id, country_name,
        effective_date, employee_count, nature_of_work, address, city, state, pin,
        pf_code, pf_status, esi_applicable, esi_code, lwf_code, pt_reg_no, pt_state,
        contact_name, email, mobile, created_by_company_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26
      )
      RETURNING *
      `,
      [...writeValues(payload), parseRowId(payload.createdByCompanyId)]
    );

    return mapEstablishment(rows[0]);
  },

  async update(id, payload) {
    const rowId = parseRowId(id);

    if (!rowId) {
      return null;
    }

    await ensureTable();
    const { rows } = await db.query(
      `
      UPDATE public.ca_establishments SET
        name = $2,
        type = $3,
        status = $4,
        company_id = $5,
        company_source = $6,
        company_name = $7,
        country_id = $8,
        country_name = $9,
        effective_date = $10,
        employee_count = $11,
        nature_of_work = $12,
        address = $13,
        city = $14,
        state = $15,
        pin = $16,
        pf_code = $17,
        pf_status = $18,
        esi_applicable = $19,
        esi_code = $20,
        lwf_code = $21,
        pt_reg_no = $22,
        pt_state = $23,
        contact_name = $24,
        email = $25,
        mobile = $26
      WHERE id = $1
      RETURNING *
      `,
      [rowId, ...writeValues(payload)]
    );

    return rows[0] ? mapEstablishment(rows[0]) : null;
  },

  async updateStatus(id, status) {
    const rowId = parseRowId(id);

    if (!rowId) {
      return null;
    }

    await ensureTable();
    const { rows } = await db.query(
      `
      UPDATE public.ca_establishments
      SET status = $2
      WHERE id = $1
      RETURNING *
      `,
      [rowId, status]
    );

    return rows[0] ? mapEstablishment(rows[0]) : null;
  },
};
