import { db } from "../../core/db/pool.js";
import { FREE_TRIAL_DAYS, companiesAlterSql, companiesTableSql, initialsFrom, mapCompany } from "./companies.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(companiesTableSql);
      for (const statement of companiesAlterSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
    })();
  }

  return ready;
};

export const companiesRepository = {
  async list() {
    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT
        id, legal_name, trade_name, pan, gstin, countries, uen, ssm, dbd,
        street, city, state, pin, contact_name, email, mobile, logo_url,
        initials, accent, status, plan, users, establishments,
        monthly_value, trial_days_left, created_at, trial_started_at,
        billing_country_id, billing_currency_code, billing_currency_symbol, country_users, onboard_amount, address_country_id
      FROM public.companies
      ORDER BY id DESC
      `
    );

    return rows.map(mapCompany);
  },

  async findByPan(pan, excludeId) {
    await ensureTable();
    const { rows } = await db.query(
      excludeId
        ? `
          SELECT id
          FROM public.companies
          WHERE upper(pan) = upper($1) AND id <> $2
          LIMIT 1
          `
        : `
          SELECT id
          FROM public.companies
          WHERE upper(pan) = upper($1)
          LIMIT 1
          `,
      excludeId ? [pan, excludeId] : [pan]
    );

    return rows[0] ?? null;
  },

  async findById(id) {
    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT
        id, legal_name, trade_name, pan, gstin, countries, uen, ssm, dbd,
        street, city, state, pin, contact_name, email, mobile, logo_url,
        initials, accent, status, plan, users, establishments,
        monthly_value, trial_days_left, created_at, trial_started_at,
        billing_country_id, billing_currency_code, billing_currency_symbol, country_users, onboard_amount, address_country_id
      FROM public.companies
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    return rows[0] ? mapCompany(rows[0]) : null;
  },

  async findLogoKey(id) {
    await ensureTable();
    const { rows } = await db.query(
      `
      SELECT logo_url
      FROM public.companies
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    return rows[0]?.logo_url ?? null;
  },

  async create(payload) {
    await ensureTable();
    const initials = payload.initials || initialsFrom(payload.legalName, payload.tradeName);
    const { rows } = await db.query(
      `
      INSERT INTO public.companies (
        legal_name, trade_name, pan, gstin, countries, uen, ssm, dbd,
        street, city, state, pin, contact_name, email, mobile, initials,
        plan, users, monthly_value, trial_days_left, password_hash, logo_url,
        billing_country_id, billing_currency_code, billing_currency_symbol, country_users, onboard_amount, address_country_id,
        status, trial_started_at
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26::jsonb, $27, $28,
        $29, $30
      )
      RETURNING *
      `,
      [
        payload.legalName,
        payload.tradeName,
        payload.pan,
        payload.gstin,
        JSON.stringify(payload.countries),
        payload.uen,
        payload.ssm,
        payload.dbd,
        payload.street,
        payload.city,
        payload.state,
        payload.pin,
        payload.contactName,
        payload.email,
        payload.mobile,
        initials,
        payload.plan,
        payload.users,
        payload.monthlyValue,
        payload.trialDaysLeft,
        payload.passwordHash,
        payload.logoUrl,
        payload.billingCountryId,
        payload.billingCurrencyCode,
        payload.billingCurrencySymbol,
        JSON.stringify(payload.countryUsers ?? {}),
        payload.onboardAmount ?? null,
        payload.addressCountryId || null,
        payload.status || (payload.plan === "Free Trial" ? "Active" : "Inactive"),
        payload.plan === "Free Trial" ? new Date() : null,
      ]
    );

    return mapCompany(rows[0]);
  },

  async update(id, payload) {
    await ensureTable();
    const initials = payload.initials || initialsFrom(payload.legalName, payload.tradeName);
    const { rows } = await db.query(
      `
      UPDATE public.companies SET
        legal_name = $2,
        trade_name = $3,
        pan = $4,
        gstin = $5,
        countries = $6::jsonb,
        uen = $7,
        ssm = $8,
        dbd = $9,
        street = $10,
        city = $11,
        state = $12,
        pin = $13,
        contact_name = $14,
        email = $15,
        mobile = $16,
        initials = $17,
        plan = $18,
        users = $19,
        monthly_value = $20,
        trial_days_left = $21,
        password_hash = COALESCE($22, password_hash),
        logo_url = COALESCE($23, logo_url),
        billing_country_id = $24,
        billing_currency_code = $25,
        billing_currency_symbol = $26,
        country_users = $27::jsonb,
        onboard_amount = $28,
        address_country_id = $29
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        payload.legalName,
        payload.tradeName,
        payload.pan,
        payload.gstin,
        JSON.stringify(payload.countries),
        payload.uen,
        payload.ssm,
        payload.dbd,
        payload.street,
        payload.city,
        payload.state,
        payload.pin,
        payload.contactName,
        payload.email,
        payload.mobile,
        initials,
        payload.plan,
        payload.users,
        payload.monthlyValue,
        payload.trialDaysLeft,
        payload.passwordHash ?? null,
        payload.logoUrl ?? null,
        payload.billingCountryId,
        payload.billingCurrencyCode,
        payload.billingCurrencySymbol,
        JSON.stringify(payload.countryUsers ?? {}),
        payload.onboardAmount ?? null,
        payload.addressCountryId || null,
      ]
    );

    return rows[0] ? mapCompany(rows[0]) : null;
  },

  async updateStatus(id, status) {
    await ensureTable();
    const next = status === "Active" ? "Active" : "Inactive";
    const { rows } = await db.query(
      `
      UPDATE public.companies
      SET
        status = $2,
        trial_started_at = CASE
          WHEN $2 = 'Active' AND plan <> 'Standard' THEN NOW()
          ELSE trial_started_at
        END,
        trial_days_left = CASE
          WHEN $2 = 'Active' AND plan <> 'Standard' THEN $3
          ELSE trial_days_left
        END
      WHERE id = $1
      RETURNING *
      `,
      [id, next, FREE_TRIAL_DAYS]
    );

    return rows[0] ? mapCompany(rows[0]) : null;
  },

  async markInactive(id) {
    await ensureTable();
    const { rows } = await db.query(
      `
      UPDATE public.companies
      SET status = 'Inactive', trial_days_left = 0
      WHERE id = $1
      RETURNING id
      `,
      [id],
    );
    return (rows[0] && rows[0].id) || null;
  },

  async updateUsers(id, payload) {
    await ensureTable();
    const { rows } = await db.query(
      `
      UPDATE public.companies
      SET
        users = $2,
        monthly_value = $3,
        country_users = $4::jsonb,
        onboard_amount = $5,
        billing_currency_code = COALESCE($6, billing_currency_code),
        billing_currency_symbol = COALESCE($7, billing_currency_symbol)
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        payload.users,
        payload.monthlyValue,
        JSON.stringify(payload.countryUsers ?? {}),
        payload.onboardAmount ?? null,
        payload.billingCurrencyCode ?? null,
        payload.billingCurrencySymbol ?? null,
      ]
    );

    return rows[0] ? mapCompany(rows[0]) : null;
  },
};
