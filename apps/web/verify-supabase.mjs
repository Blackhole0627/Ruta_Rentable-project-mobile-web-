// One-off Supabase health check. Reads creds from apps/web/.env.
// Run:  node verify-supabase.mjs   (from apps/web)
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const txt = readFileSync(new URL('./.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[1m${s}\x1b[0m`;

console.log(B('\n=== SUPABASE VERIFICATION ==='));
console.log('URL :', URL_);
console.log('KEY :', KEY ? KEY.slice(0, 14) + '…' + KEY.slice(-4) : '(none)');
console.log('keyType:', KEY?.startsWith('sb_publishable_') ? 'new publishable key' : KEY?.startsWith('eyJ') ? 'legacy JWT anon key' : 'UNKNOWN');

if (!URL_ || !KEY || URL_.includes('your-project') || KEY.includes('your-anon-key')) {
  console.log(R('\n✗ Credentials placeholder/missing → app would run in MOCK mode.'));
  process.exit(1);
}

const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const TABLES = [
  'users', 'user_vehicles', 'trips', 'parameters', 'plans', 'subscriptions',
  'payments', 'announcements', 'cooperatives', 'coop_members', 'notifications',
  'vehicle_catalog', 'kyc_submissions',
];
const PUBLIC_READ = new Set(['plans', 'vehicle_catalog', 'announcements']);
const RPCS = [
  'admin_list_users', 'admin_metrics', 'find_user_id_by_email', 'my_pending_invites',
  'my_cooperative', 'leave_cooperative', 'broadcast_announcement',
  'promote_admin_if_allowed', 'admin_upsert_vehicle_catalog', 'admin_delete_vehicle_catalog',
];
const FUNCTIONS = ['send-welcome', 'delete-account', 'calculate-trip', 'poket-create-link', 'poket-webhook'];
const BUCKETS = ['kyc-docs'];

function classify(error) {
  if (!error) return null;
  const msg = (error.message || '') + ' ' + (error.code || '');
  if (/does not exist|relation .* does not exist|42P01|Could not find the table|PGRST205/i.test(msg)) return 'MISSING';
  if (/permission denied|42501|JWT|row-level security|not authorized/i.test(msg)) return 'RLS';
  if (/Could not find the function|PGRST202|42883/i.test(msg)) return 'NO_FUNC';
  return 'ERR';
}

async function checkTables() {
  console.log(B('\n--- TABLES ---'));
  for (const t of TABLES) {
    const { data, error, count } = await sb.from(t).select('*', { count: 'exact', head: true });
    const kind = classify(error);
    if (!kind) {
      const rows = count ?? 0;
      if (PUBLIC_READ.has(t) && rows === 0)
        console.log(`${Y('⚠')} ${t.padEnd(18)} exists, but 0 rows (expected seed data?)`);
      else
        console.log(`${G('✓')} ${t.padEnd(18)} OK (${rows} rows visible)`);
    } else if (kind === 'MISSING') {
      console.log(`${R('✗')} ${t.padEnd(18)} TABLE MISSING — run migration`);
    } else if (kind === 'RLS') {
      console.log(`${G('✓')} ${t.padEnd(18)} exists (RLS blocks anon read — normal)`);
    } else {
      console.log(`${R('✗')} ${t.padEnd(18)} ${error.message}`);
    }
  }
}

async function checkRpcs() {
  console.log(B('\n--- RPC FUNCTIONS ---'));
  for (const fn of RPCS) {
    const { error } = await sb.rpc(fn, {});
    const kind = classify(error);
    if (kind === 'NO_FUNC') {
      // maybe needs args → param-count mismatch still means it EXISTS
      if (/without parameters|argument|PGRST202/i.test(error.message)) {
        console.log(`${G('✓')} ${fn.padEnd(28)} exists (needs args)`);
      } else {
        console.log(`${R('✗')} ${fn.padEnd(28)} NOT FOUND`);
      }
    } else if (!kind || kind === 'RLS' || kind === 'ERR') {
      console.log(`${G('✓')} ${fn.padEnd(28)} exists${kind ? ' (' + kind.toLowerCase() + ' on anon — normal)' : ''}`);
    }
  }
}

async function checkBuckets() {
  console.log(B('\n--- STORAGE BUCKETS ---'));
  for (const b of BUCKETS) {
    const { error } = await sb.storage.from(b).list('', { limit: 1 });
    if (!error) console.log(`${G('✓')} ${b.padEnd(18)} exists & listable`);
    else if (/not found|does not exist|Bucket not found/i.test(error.message))
      console.log(`${R('✗')} ${b.padEnd(18)} BUCKET MISSING — run kyc_setup.sql / create bucket`);
    else console.log(`${G('✓')} ${b.padEnd(18)} exists (private — ${error.message})`);
  }
}

async function checkFunctions() {
  console.log(B('\n--- EDGE FUNCTIONS ---'));
  for (const fn of FUNCTIONS) {
    try {
      const res = await fetch(`${URL_}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', apikey: KEY },
        body: '{}',
      });
      if (res.status === 404)
        console.log(`${R('✗')} ${fn.padEnd(20)} NOT DEPLOYED (404)`);
      else
        console.log(`${G('✓')} ${fn.padEnd(20)} deployed (HTTP ${res.status})`);
    } catch (e) {
      console.log(`${R('✗')} ${fn.padEnd(20)} ${e.message}`);
    }
  }
}

async function checkAuth() {
  console.log(B('\n--- AUTH ---'));
  const { data, error } = await sb.auth.getSession();
  if (error) console.log(`${R('✗')} auth endpoint error: ${error.message}`);
  else console.log(`${G('✓')} auth endpoint reachable (no active session — expected)`);
}

await checkAuth();
await checkTables();
await checkRpcs();
await checkBuckets();
await checkFunctions();
console.log(B('\n=== DONE ===\n'));
