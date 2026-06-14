// Supabase Edge Function: poket-webhook
//
// Public endpoint that LAFISE Poket calls on payment events. Poket does NOT
// sign the body with an HMAC — instead it authenticates TO this endpoint with
// a shared credential we configure with the bank (Basic auth, OAuth2, or an
// API key). We verify that credential on every call; without it anyone could
// POST a fake "payment succeeded".
//
// Events (see Poket docs):
//   - StartPayment  : attempt begun. Respond 200 to allow, 400 to reject.
//   - FinishPayment : attempt finished. status 'Authorized' = paid,
//                     'Failed' = declined/timeout. Response body is ignored.
//
// Verification accepts whichever the bank is configured to send:
//   * header `x-api-key` / `x-webhook-secret` == POKET_WEBHOOK_SECRET, or
//   * HTTP Basic == POKET_WEBHOOK_BASIC_USER : POKET_WEBHOOK_BASIC_PASS
// Set POKET_WEBHOOK_ALLOW_INSECURE=true ONLY to wire up QA before the secret
// exists; never in production.
//
// Deploy:  supabase functions deploy poket-webhook --no-verify-jwt
// (the --no-verify-jwt flag is required: Poket has no Supabase user JWT.)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Constant-time-ish string compare to avoid leaking length/timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  if ((Deno.env.get('POKET_WEBHOOK_ALLOW_INSECURE') ?? '').toLowerCase() === 'true') {
    return true;
  }
  const secret = Deno.env.get('POKET_WEBHOOK_SECRET');
  if (secret) {
    const provided =
      req.headers.get('x-api-key') ?? req.headers.get('x-webhook-secret') ?? '';
    if (provided && safeEqual(provided, secret)) return true;
  }
  const basicUser = Deno.env.get('POKET_WEBHOOK_BASIC_USER');
  const basicPass = Deno.env.get('POKET_WEBHOOK_BASIC_PASS');
  if (basicUser && basicPass) {
    const header = req.headers.get('Authorization') ?? '';
    if (header.startsWith('Basic ')) {
      try {
        const [u, p] = atob(header.slice(6)).split(':');
        if (u !== undefined && p !== undefined && safeEqual(u, basicUser) && safeEqual(p, basicPass)) {
          return true;
        }
      } catch {
        /* malformed header → unauthorized */
      }
    }
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isAuthorized(req)) return json({ error: 'Unauthorized' }, 401);

  let event: Record<string, unknown>;
  try {
    event = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const eventType = String(event.event_type ?? '');
  const externalLinkId = event.external_link_id ? String(event.external_link_id) : '';
  if (!externalLinkId) return json({ error: 'Missing external_link_id' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Locate the pending payment this event belongs to.
  const { data: payment } = await admin
    .from('payments')
    .select('*')
    .eq('external_link_id', externalLinkId)
    .maybeSingle();

  // StartPayment: optional pre-validation. Accept if we recognise the link.
  if (eventType === 'StartPayment') {
    if (!payment) {
      console.warn('StartPayment for unknown link', externalLinkId);
      return json({ error: 'Unknown payment link' }, 400);
    }
    return json({ ok: true }, 200);
  }

  if (eventType !== 'FinishPayment') {
    // Unknown event — acknowledge so Poket doesn't retry forever.
    console.warn('Unhandled Poket event_type', eventType);
    return json({ ok: true }, 200);
  }

  if (!payment) {
    console.warn('FinishPayment for unknown link', externalLinkId);
    return json({ ok: true }, 200); // ack; nothing to do
  }

  // Idempotency: ignore replays once the row reached a terminal state.
  if (payment.status === 'confirmed' || payment.status === 'rejected') {
    return json({ ok: true, idempotent: true }, 200);
  }

  const status = String(event.status ?? '');
  const tryId = event.try_id ? String(event.try_id) : null;
  const paid = status === 'Authorized';

  // Update the payment row to its terminal state.
  await admin
    .from('payments')
    .update({
      status: paid ? 'confirmed' : 'rejected',
      provider_status: status,
      external_payment_id: tryId,
    })
    .eq('id', payment.id);

  if (paid) {
    // Activate the subscription. Expiry is recomputed client-side from the last
    // confirmed payment + the plan's durationDays (same as the manual flow), so
    // we only flip status/plan here.
    await admin
      .from('users')
      .update({
        subscription_status: 'active',
        current_plan: payment.plan_id ?? undefined,
        free_calculations_used: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.user_id);

    await admin.from('notifications').insert({
      id: crypto.randomUUID(),
      user_id: payment.user_id,
      title: 'Pago aprobado',
      body: 'Tu suscripción está activa. ¡Gracias!',
      kind: 'system',
      link: '/suscripcion',
      read: false,
      created_at: new Date().toISOString(),
    });
  } else {
    const reason = event.error_reason ? String(event.error_reason) : '';
    await admin.from('notifications').insert({
      id: crypto.randomUUID(),
      user_id: payment.user_id,
      title: 'Pago rechazado',
      body: reason
        ? `No se pudo procesar el pago: ${reason}. Intenta de nuevo.`
        : 'No se pudo procesar el pago. Intenta de nuevo.',
      kind: 'system',
      link: '/suscripcion',
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  return json({ ok: true }, 200);
});
