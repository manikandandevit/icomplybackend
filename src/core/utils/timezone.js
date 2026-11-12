import { db } from "../db/pool.js";

/**
 * Maps country ID (1 = India, 2 = Singapore, 3 = Malaysia) or country name to IANA timezone.
 * Defaults to "Asia/Kolkata".
 */
export function zoneForCountry(countryIdOrName) {
  if (!countryIdOrName) return "Asia/Kolkata";
  const str = String(countryIdOrName).trim().toLowerCase();
  if (str === "1" || str === "in" || str === "india" || str.includes("kolkata") || str.includes("india")) {
    return "Asia/Kolkata";
  }
  if (str === "2" || str === "sg" || str === "singapore") {
    return "Asia/Singapore";
  }
  if (str === "3" || str === "my" || str === "malaysia" || str.includes("kuala_lumpur")) {
    return "Asia/Kuala_Lumpur";
  }
  return "Asia/Kolkata";
}

// In-memory cache for establishment timezone: Map<establishmentId, { zone: string, expiresAt: number }>
const establishmentCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Resolves the IANA timezone for an establishment.
 * Checks in-memory cache first, then queries ca_establishments.
 */
export async function zoneForEstablishment(establishmentId, clientOrPool = db) {
  if (!establishmentId) return "Asia/Kolkata";
  const idNum = Number(establishmentId);
  const now = Date.now();
  const cached = establishmentCache.get(idNum);
  if (cached && cached.expiresAt > now) {
    return cached.zone;
  }

  try {
    const res = await clientOrPool.query(
      `SELECT timezone, country_id, country_name FROM public.ca_establishments WHERE id = $1 LIMIT 1`,
      [idNum]
    );
    let zone = "Asia/Kolkata";
    if (res.rows.length > 0) {
      const row = res.rows[0];
      if (row.timezone && row.timezone.trim()) {
        zone = row.timezone.trim();
      } else {
        zone = zoneForCountry(row.country_id || row.country_name);
      }
    }
    establishmentCache.set(idNum, { zone, expiresAt: now + CACHE_TTL_MS });
    return zone;
  } catch (err) {
    console.error(`[timezone] Failed to resolve zone for establishment ${establishmentId}:`, err?.message);
    return "Asia/Kolkata";
  }
}

/**
 * Resolves the IANA timezone for an employee by joining or looking up their establishment.
 */
export async function zoneForEmployee(employeeId, companyId = null, clientOrPool = db) {
  if (!employeeId) return "Asia/Kolkata";
  try {
    const params = [Number(employeeId)];
    let query = `
      SELECT e.establishment_id, est.timezone, est.country_id, est.country_name
      FROM public.ca_employees e
      LEFT JOIN public.ca_establishments est ON est.id = e.establishment_id
      WHERE e.id = $1
    `;
    if (companyId) {
      query += ` AND e.created_by_company_id = $2`;
      params.push(Number(companyId));
    }
    query += ` LIMIT 1`;

    const res = await clientOrPool.query(query, params);
    if (res.rows.length === 0) return "Asia/Kolkata";

    const row = res.rows[0];
    if (row.timezone && row.timezone.trim()) return row.timezone.trim();
    if (row.country_id || row.country_name) return zoneForCountry(row.country_id || row.country_name);
    if (row.establishment_id) return zoneForEstablishment(row.establishment_id, clientOrPool);
    return "Asia/Kolkata";
  } catch (err) {
    console.error(`[timezone] Failed to resolve zone for employee ${employeeId}:`, err?.message);
    return "Asia/Kolkata";
  }
}

/**
 * Returns today's date in YYYY-MM-DD string format in the target timezone.
 */
export function todayIn(zone = "Asia/Kolkata", now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d); // en-CA produces YYYY-MM-DD
}

/**
 * Calculates minutes since local midnight for a date in the given timezone.
 */
export function minutesOfDayIn(zone = "Asia/Kolkata", date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);

  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "hour") hour = Number(p.value);
    if (p.type === "minute") minute = Number(p.value);
  }
  return hour * 60 + minute;
}

/**
 * Converts a calendar date ("YYYY-MM-DD") and clock time ("HH:mm" or "hh:mm a")
 * in the specified timezone into a UTC JavaScript Date object.
 * Avoids any hardcoded offsets (+05:30) by calculating the zone's actual offset.
 */
export function zonedDateTimeToUtc(dateKey, timeStr, zone = "Asia/Kolkata") {
  if (!dateKey || !timeStr) return null;
  const raw = String(timeStr).trim();

  let hour = 0;
  let minute = 0;
  let second = 0;

  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (ampmMatch) {
    hour = Number(ampmMatch[1]);
    minute = Number(ampmMatch[2]);
    second = ampmMatch[3] ? Number(ampmMatch[3]) : 0;
    const ampm = (ampmMatch[4] || "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  } else {
    const parts = raw.split(":").map(Number);
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      hour = parts[0];
      minute = parts[1];
      second = parts[2] || 0;
    } else {
      return null;
    }
  }

  const [y, m, d] = String(dateKey).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;

  // We want to find the UTC time T such that formatted in `zone` it equals [y, m, d, hour, minute, second].
  // 1. Initial guess: Treat the components as UTC:
  const guessUtc = Date.UTC(y, m - 1, d, hour, minute, second);

  // 2. Format guessUtc in `zone` to see what local components it produces:
  const offsetMs = getZoneOffsetMs(guessUtc, zone);

  // 3. Subtract that offset to get the correct UTC time:
  return new Date(guessUtc - offsetMs);
}

/**
 * Returns the offset in ms between the target timezone and UTC at the given UTC timestamp.
 * (Target local time - UTC time = offset)
 */
function getZoneOffsetMs(utcTimestamp, zone) {
  const d = new Date(utcTimestamp);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);

  let py = 0, pm = 0, pd = 0, ph = 0, pmin = 0, ps = 0;
  for (const p of parts) {
    if (p.type === "year") py = Number(p.value);
    if (p.type === "month") pm = Number(p.value);
    if (p.type === "day") pd = Number(p.value);
    if (p.type === "hour") ph = Number(p.value);
    if (p.type === "minute") pmin = Number(p.value);
    if (p.type === "second") ps = Number(p.value);
  }

  const asLocalUtc = Date.UTC(py, pm - 1, pd, ph, pmin, ps);
  return asLocalUtc - utcTimestamp;
}

/**
 * Returns the weekday (0 = Sunday, 1 = Monday, ..., 6 = Saturday) of a dateKey ("YYYY-MM-DD") in the specified zone.
 */
export function weekdayIn(zone = "Asia/Kolkata", dateKey) {
  if (!dateKey) return null;
  const d = zonedDateTimeToUtc(dateKey, "12:00", zone);
  if (!d) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
  }).formatToParts(d);

  const wStr = parts.find(p => p.type === "weekday")?.value?.toLowerCase();
  const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  return map[wStr] ?? d.getDay();
}

/**
 * Returns the UTC Date for the exact start of day (00:00:00.000) for dateKey in the specified zone.
 */
export function startOfDayUtc(dateKey, zone = "Asia/Kolkata") {
  return zonedDateTimeToUtc(dateKey, "00:00", zone);
}

/**
 * Formats a Date/timestamp into "HH:mm" in the specified timezone.
 */
export function formatTimeInZone(date, zone = "Asia/Kolkata") {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}


/**
 * Any stored value → IANA zone: an IANA name ("Asia/Kuala_Lumpur") is used as is,
 * otherwise it is treated as a country id / name.
 */
export function resolveZone(value) {
  const raw = String(value || "").trim();
  if (raw.includes("/")) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: raw });
      return raw;
    } catch {
      // not a valid IANA name, fall back to the country mapping
    }
  }
  return zoneForCountry(raw);
}

/** Offset of the zone from UTC in minutes at that instant (IST 330, SGT/MYT 480). */
export function utcOffsetMinutesFor(zone = "Asia/Kolkata", date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}
