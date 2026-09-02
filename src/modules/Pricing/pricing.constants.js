import { countryIndexSql, countryTableSql } from "../Country/country.constants.js";

export { countryIndexSql, countryTableSql };

export const pricingTableSql = `
CREATE TABLE IF NOT EXISTS public.pricing (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES public.country(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  per_user_price NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const pricingIndexSql = `
CREATE UNIQUE INDEX IF NOT EXISTS pricing_country_unique ON public.pricing (country_id);
`;

export const pricingAlterSql = `
ALTER TABLE public.pricing ADD COLUMN IF NOT EXISTS country_prices JSONB NOT NULL DEFAULT '{}'::jsonb;
`;

export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "QAR", symbol: "QR", name: "Qatari Riyal" },
  { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar" },
  { code: "BHD", symbol: "BD", name: "Bahraini Dinar" },
  { code: "OMR", symbol: "RO", name: "Omani Rial" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
  { code: "NPR", symbol: "Rs", name: "Nepalese Rupee" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "EGP", symbol: "E£", name: "Egyptian Pound" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
];

export const currencyByCode = (code) => CURRENCIES.find((item) => item.code === code) ?? null;

const COUNTRY_CURRENCY_CODES = {
  india: "INR",
  singapore: "SGD",
  malaysia: "MYR",
  thailand: "THB",
  vietnam: "VND",
  indonesia: "IDR",
  philippines: "PHP",
  "united states": "USD",
  "united kingdom": "GBP",
  australia: "AUD",
  canada: "CAD",
  "new zealand": "NZD",
  germany: "EUR",
  france: "EUR",
  italy: "EUR",
  spain: "EUR",
  netherlands: "EUR",
  japan: "JPY",
  china: "CNY",
  "south korea": "KRW",
  "united arab emirates": "AED",
  "saudi arabia": "SAR",
  "hong kong": "HKD",
};

export const currencyForCountryName = (name) => {
  const code = COUNTRY_CURRENCY_CODES[String(name ?? "").trim().toLowerCase()];
  return code ? currencyByCode(code) : null;
};

const countryPricesFrom = (row) => {
  const source =
    row.country_prices && typeof row.country_prices === "object" && !Array.isArray(row.country_prices)
      ? Object.fromEntries(
          Object.entries(row.country_prices).map(([id, price]) => [String(id), Number(price) || 0])
        )
      : {};

  if (Object.keys(source).length === 0 && row.country_id != null && row.per_user_price != null) {
    source[String(row.country_id)] = Number(row.per_user_price) || 0;
  }

  return source;
};

export const mapPricing = (row) => {
  const countryPrices = countryPricesFrom(row);
  const rootId = String(row.country_id);
  const perUserPrice = countryPrices[rootId] > 0 ? countryPrices[rootId] : Number(row.per_user_price) || 0;

  return {
    id: String(row.id),
    countryId: rootId,
    countryName: row.country_name,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    perUserPrice,
    countryPrices,
    createdAt: row.created_at,
  };
};
