import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres.ykxeqpnaggawupoiikyn:vUK8%40w%24D3%5E%5EYJxs@aws-0-ap-south-1.pooler.supabase.com:6543/postgres' });
pool.query("SELECT * FROM public.ca_statutory_configs WHERE statutory_name = 'CPF' ORDER BY updated_at DESC LIMIT 1").then(res => console.log(JSON.stringify(res.rows, null, 2))).catch(console.error).finally(() => pool.end());
