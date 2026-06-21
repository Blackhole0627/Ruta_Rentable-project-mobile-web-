#!/usr/bin/env bash
# Supabase health-check for RutaRentable. Anon-key only — no secrets needed.
# Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from apps/web/.env.
set -u

ENV_FILE="$(dirname "$0")/../apps/web/.env"
URL="$(grep -E '^VITE_SUPABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "❌ .env mein VITE_SUPABASE_URL ya VITE_SUPABASE_ANON_KEY khali hai."
  exit 1
fi
URL="${URL%/}"
echo "Project: $URL"
echo

H_KEY="apikey: $KEY"
H_AUTH="Authorization: Bearer $KEY"

# code <url> [method] [body]  -> prints HTTP status code
code() {
  local u="$1" m="${2:-GET}" b="${3:-}"
  if [ -n "$b" ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$m" -H "$H_KEY" -H "$H_AUTH" \
      -H 'Content-Type: application/json' --data "$b" "$u"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$m" -H "$H_KEY" -H "$H_AUTH" "$u"
  fi
}

echo "=== 0. Reachability / Auth ==="
hc=$(code "$URL/auth/v1/health")
echo "auth/health -> $hc $([ "$hc" = 200 ] && echo OK || echo 'FAIL (galat URL?)')"
echo

echo "=== 1. Tables (REST) ==="
# 200 = exists+readable, 401/403 = exists but RLS blocks (OK, table hai),
# 404 = table missing (migration nahi chali)
for t in users user_vehicles trips plans subscriptions payments parameters \
         vehicle_catalog announcements notifications kyc_submissions \
         cooperatives coop_members; do
  c=$(code "$URL/rest/v1/$t?select=*&limit=1")
  case "$c" in
    200|206) s="✅ exists (readable)";;
    401|403) s="✅ exists (RLS protected)";;
    404)     s="❌ MISSING (migration nahi chali)";;
    *)       s="⚠️  http $c";;
  esac
  printf '  %-16s %s\n' "$t" "$s"
done
echo

echo "=== 2. RPC functions ==="
# 404 = function deployed nahi. 401/400/200 = deployed hai (auth/args ki wajah se fail ho sakta).
for fn in promote_admin_if_allowed admin_list_users admin_metrics \
          admin_upsert_vehicle_catalog admin_delete_vehicle_catalog \
          broadcast_announcement my_cooperative my_pending_invites \
          find_user_id_by_email leave_cooperative; do
  c=$(code "$URL/rest/v1/rpc/$fn" POST '{}')
  case "$c" in
    404) s="❌ MISSING";;
    *)   s="✅ deployed (http $c)";;
  esac
  printf '  %-30s %s\n' "$fn" "$s"
done
echo

echo "=== 3. Edge Functions ==="
# 404 = deploy nahi hui. 200/401/400/500 = deployed hai.
for fn in calculate-trip delete-account send-welcome poket-create-link poket-webhook; do
  c=$(code "$URL/functions/v1/$fn" POST '{}')
  case "$c" in
    404) s="❌ NOT DEPLOYED";;
    *)   s="✅ deployed (http $c)";;
  esac
  printf '  %-20s %s\n' "$fn" "$s"
done
echo

echo "=== 4. Storage bucket (kyc-docs) ==="
c=$(code "$URL/storage/v1/bucket/kyc-docs")
case "$c" in
  200) s="✅ exists";;
  400|404) s="❌ MISSING (kyc_setup.sql nahi chali?)";;
  401|403) s="✅ exists (protected)";;
  *) s="⚠️  http $c";;
esac
echo "  kyc-docs -> $s"
echo

echo "=== 5. Plans seeded? ==="
plans=$(curl -s -H "$H_KEY" -H "$H_AUTH" "$URL/rest/v1/plans?select=id,name,price_nio")
echo "  $plans"
echo
echo "Done."
