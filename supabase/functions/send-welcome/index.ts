// Supabase Edge Function: send-welcome
// Sends a one-off welcome email (via Resend) to the calling user after they
// finish signing up. Invoked from the app once the signup OTP is verified.
//
// Deploy:  supabase functions deploy send-welcome
// Secrets: supabase secrets set RESEND_API_KEY=re_xxx
//          supabase secrets set WELCOME_FROM="RutaRentable <noreply@tudominio.com>"
//          (WELCOME_FROM is optional; defaults to the Resend test sender.)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function welcomeHtml(name: string): string {
  const hi = name ? `Hola ${name},` : 'Hola,';
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
    <h1 style="color:#16a34a;font-size:22px">¡Bienvenido a RutaRentable! 🚗</h1>
    <p>${hi}</p>
    <p>Tu cuenta ya está lista. Ahora puedes calcular si cada viaje es
       <strong>rentable</strong> antes de aceptarlo — incluyendo combustible,
       llantas, mantenimiento y depreciación.</p>
    <p style="margin-top:16px">Para empezar:</p>
    <ul style="line-height:1.7">
      <li>Registra tu vehículo (auto o moto).</li>
      <li>Calcula tu primer viaje.</li>
      <li>Revisa tus reportes de ganancias.</li>
    </ul>
    <p style="margin-top:20px;color:#64748b;font-size:13px">
      Si no creaste esta cuenta, puedes ignorar este correo.
    </p>
    <p style="color:#64748b;font-size:13px">— El equipo de RutaRentable</p>
  </div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  // Resolve the caller from their JWT so we email the right person.
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user?.email) return json({ error: 'Unauthorized' }, 401);

  const email = userData.user.email;
  const name =
    (userData.user.user_metadata?.name as string | undefined) ??
    (userData.user.user_metadata?.full_name as string | undefined) ??
    '';
  const from = Deno.env.get('WELCOME_FROM') ?? 'RutaRentable <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: '¡Bienvenido a RutaRentable!',
      html: welcomeHtml(name),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: 'Resend failed', detail }, 502);
  }
  return json({ ok: true });
});
