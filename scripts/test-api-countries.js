import "dotenv/config";

const base = "http://localhost:4000/api";

const login = await fetch(`${base}/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "deepa@innodha.com", password: "Comply@123" }),
}).then((r) => r.json());

console.log("login", login.success, login.message, login.data?.token ? "hasToken" : "noToken", login.data?.user);

const token = login.data?.token || login.data?.accessToken;
if (!token) {
  console.log("full login", JSON.stringify(login, null, 2));
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}` };
const companies = await fetch(`${base}/ca-companies`, { headers }).then((r) => r.json());
const countries = await fetch(`${base}/countries`, { headers }).then((r) => r.json());

console.log("parent.countries", companies.data?.parent?.countries);
console.log("countries", countries.data?.countries);

const masterCountries = countries.data?.countries || [];
const byId = new Map(masterCountries.map((c) => [String(c.id), c]));
const saved = Array.isArray(companies.data?.parent?.countries) ? companies.data.parent.countries : [];
const options = [];
for (const raw of saved) {
  const key = String(raw).trim();
  const match = byId.get(key);
  if (match) options.push({ value: match.id, label: match.name });
}
console.log("mapped options", options);
