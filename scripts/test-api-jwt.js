import "dotenv/config";
import jwt from "jsonwebtoken";

const token = jwt.sign(
  {
    sub: "company:7",
    email: "deepa@innodha.com",
    role: "CompanyAdmin",
    type: "company",
    companyId: "7",
  },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

const base = "http://localhost:4000/api";
const headers = { Authorization: `Bearer ${token}` };

const companies = await fetch(`${base}/ca-companies`, { headers }).then((r) => r.json());
const countries = await fetch(`${base}/countries`, { headers }).then((r) => r.json());

console.log("parent keys", companies.data?.parent ? Object.keys(companies.data.parent) : null);
console.log("parent.countries", companies.data?.parent?.countries);
console.log("countries count", countries.data?.countries?.length);
console.log("countries", countries.data?.countries);

const LEGACY = { in: "india", sg: "singapore", my: "malaysia", th: "thailand" };
const masterCountries = countries.data?.countries || [];
const byId = new Map(masterCountries.map((c) => [String(c.id), c]));
const byName = new Map(masterCountries.map((c) => [c.name.trim().toLowerCase(), c]));
const saved = Array.isArray(companies.data?.parent?.countries) ? companies.data.parent.countries : [];
const options = [];
for (const raw of saved) {
  const key = String(raw).trim();
  const match =
    byId.get(key) ||
    byName.get(key.toLowerCase()) ||
    byName.get(LEGACY[key.toLowerCase()] || "");
  if (!match) {
    console.log("NO MATCH", raw);
    continue;
  }
  options.push({ value: match.id, label: match.name });
}
console.log("FINAL OPTIONS", options);
