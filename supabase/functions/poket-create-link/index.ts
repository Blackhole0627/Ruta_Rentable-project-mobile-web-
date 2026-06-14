// Supabase Edge Function: poket-create-link
//
// Called by the app when a driver chooses to pay for a plan with a card.
// It must run server-side because the Poket API uses OAuth2 client-credentials
// (secret) and requires the caller's IP to be whitelisted by LAFISE.
//
// Flow:
//   1. Resolve the caller from their JWT.
//   2. Read the plan price authoritatively from the DB (never trust the client).
//   3. Create a Poket PayLink (card / Cybersource).
//   4. Insert a `pending` payment row carrying the returned external_link_id.
//   5. Return the hosted checkout URL for the app to redirect to.
//
// Activation happens later, in poket-webhook, when Poket reports the payment.
//
// Deploy:  supabase functions deploy poket-create-link
// Secrets: see _shared/poket.ts (POKET_* credentials) + POKET_RETURN_URL.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  createPayLink,
  getAccessToken,
  PoketConfigError,
  poketSecret,
} from '../_shared/poket.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // --- Resolve the caller from their JWT ---
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
  const user = userData.user;

  // --- Parse request ---
  let planId: string | undefined;
  try {
    const payload = await req.json();
    planId = payload?.planId;
  } catch {
    /* fall through to validation below */
  }
  if (!planId) return json({ error: 'planId is required' }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  // --- Authoritative plan price from the DB ---
  const { data: plan } = await admin
    .from('plans')
    .select('id, name, price_nio, is_active')
    .eq('id', planId)
    .maybeSingle();
  if (!plan || plan.is_active === false) return json({ error: 'Plan not available' }, 400);
  const amount = Number(plan.price_nio ?? 0);
  if (!amount || amount <= 0) return json({ error: 'Plan is not payable' }, 400);

  const paymentId = crypto.randomUUID();
  const description = `RutaRentable ${plan.name} - ${user.email ?? user.id}`.slice(0, 120);
  const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  // Poket redirects the payer here after a finished attempt; the app re-reads
  // status from the DB (which the webhook updates), so a single URL is enough.
  const returnUrl = poketSecret('RETURN_URL');

  // --- Create the PayLink ---
  let payLink;
  try {
    const accessToken = await getAccessToken();
    payLink = await createPayLink(accessToken, {
      amount,
      currency: 'NIO',
      description,
      callbackUrl: returnUrl,
      expirationDate,
    });
  } catch (err) {
    if (err instanceof PoketConfigError) {
      console.error('Poket config error:', err.message);
      return json({ error: 'Payment gateway not configured' }, 503);
    }
    console.error('Poket create-link error:', err);
    return json({ error: 'Could not create payment link' }, 502);
  }

  // --- Record the pending payment carrying the external_link_id ---
  const { error: insertErr } = await admin.from('payments').insert({
    id: paymentId,
    user_id: user.id,
    plan_id: planId,
    amount,
    currency: 'NIO',
    method: 'poket',
    status: 'pending',
    provider: 'poket',
    external_link_id: payLink.id,
    provider_status: payLink.status,
    checkout_url: payLink.payLinkUrl,
    paid_at: new Date().toISOString(),
  });
  if (insertErr) {
    console.error('Failed to record pending payment:', insertErr);
    return json({ error: 'Could not record payment' }, 500);
  }

  return json({ checkoutUrl: payLink.payLinkUrl, paymentId, externalLinkId: payLink.id });
});
