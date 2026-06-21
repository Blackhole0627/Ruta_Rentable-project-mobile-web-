#!/usr/bin/env bash
# Deploy all RutaRentable edge functions.
# PREREQUISITE (one time, interactive — run it yourself first):
#   supabase login
set -e

REF="lvposxnatygyzwuvfxzp"

echo "==> Deploying send-welcome"
supabase functions deploy send-welcome      --project-ref "$REF"

echo "==> Deploying delete-account"
supabase functions deploy delete-account    --project-ref "$REF"

echo "==> Deploying calculate-trip"
supabase functions deploy calculate-trip    --project-ref "$REF"

echo "==> Deploying poket-create-link"
supabase functions deploy poket-create-link --project-ref "$REF"

# Webhook is called by LAFISE (external), so no user JWT — disable JWT check.
echo "==> Deploying poket-webhook (no JWT)"
supabase functions deploy poket-webhook     --project-ref "$REF" --no-verify-jwt

echo ""
echo "All functions deployed. Re-run apps/web/verify-supabase.mjs to confirm."
