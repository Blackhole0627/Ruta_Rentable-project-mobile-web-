// Supabase Edge Function: delete-account
// Deletes the calling user's auth account; ON DELETE CASCADE removes their rows.
// Deploy: supabase functions deploy delete-account
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Browser calls (supabase.functions.invoke from the SPA) are cross-origin, so
// the function must answer the CORS preflight and echo CORS headers on every
// response — otherwise the request is blocked before it reaches the logic.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Resolve the caller from their JWT.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Delete with the service role (also removes the users row via cascade).
  const admin = createClient(url, serviceKey);
  const { error } = await admin.auth.admin.deleteUser(userData.user.id);
  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true });
});
