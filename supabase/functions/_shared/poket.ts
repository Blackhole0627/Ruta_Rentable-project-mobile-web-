// Shared LAFISE Poket client for the Edge Functions.
//
// Reads all credentials from Edge-Function secrets. To keep QA and production
// fully separate, every secret is resolved as POKET_<NAME>_<ENV> first and
// falls back to POKET_<NAME>. Flip the whole integration with `POKET_ENV`.
//
//   supabase secrets set POKET_ENV=qa
//   supabase secrets set POKET_CLIENT_ID_QA=...      POKET_CLIENT_ID_PROD=...
//   supabase secrets set POKET_CLIENT_SECRET_QA=...  POKET_CLIENT_SECRET_PROD=...
//   supabase secrets set POKET_API_KEY_QA=...        POKET_API_KEY_PROD=...
//   supabase secrets set POKET_TERMINAL_ID_QA=...    POKET_TERMINAL_ID_PROD=...
//   supabase secrets set POKET_TRANSACTING_MID_QA=.. POKET_TRANSACTING_MID_PROD=..
//   supabase secrets set POKET_API_BASE_PROD=https://poket-api.lafise.com   # prod host
//   supabase secrets set POKET_COLLECTOR_NAME="RutaRentable"
//   supabase secrets set POKET_COLLECTOR_PHOTO="https://cdn.../logo.png"     # optional

export type PoketEnv = 'qa' | 'prod';

export function poketEnv(): PoketEnv {
  return (Deno.env.get('POKET_ENV') ?? 'qa').toLowerCase() === 'prod' ? 'prod' : 'qa';
}

/** Resolve a secret, preferring the env-suffixed variant. */
export function poketSecret(name: string): string | undefined {
  const env = poketEnv().toUpperCase();
  return Deno.env.get(`POKET_${name}_${env}`) ?? Deno.env.get(`POKET_${name}`);
}

/** API base URL. QA host is known; prod must be supplied via secret. */
export function poketApiBase(): string {
  const explicit = poketSecret('API_BASE');
  if (explicit) return explicit.replace(/\/+$/, '');
  return poketEnv() === 'prod'
    ? 'https://poket-api.lafise.com' // override with POKET_API_BASE_PROD if different
    : 'https://poket-api-qa.lafise.com';
}

export class PoketConfigError extends Error {}

function required(name: string): string {
  const v = poketSecret(name);
  if (!v) throw new PoketConfigError(`Missing Poket secret POKET_${name} (env=${poketEnv()})`);
  return v;
}

/**
 * OAuth2 client-credentials token (valid ~60 min). The token endpoint uses HTTP
 * Basic auth (client_id:secret) plus the x-api-key header, per the Poket docs.
 */
export async function getAccessToken(): Promise<string> {
  const clientId = required('CLIENT_ID');
  const clientSecret = required('CLIENT_SECRET');
  const apiKey = required('API_KEY');
  const basic = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(`${poketApiBase()}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-api-key': apiKey,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) {
    throw new Error(`Poket auth failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Poket auth: no access_token in response');
  return data.access_token as string;
}

export interface CreatePayLinkInput {
  amount: number;
  currency: string; // 'NIO' for Nicaragua
  description: string;
  /** Where Poket redirects the payer back to after a finished attempt. */
  callbackUrl?: string;
  /** ISO datetime the link stops accepting payments. */
  expirationDate: string;
  maxTries?: number;
}

export interface PayLink {
  id: string; // == webhook external_link_id
  payLinkUrl: string; // hosted checkout URL
  status: string;
  raw: unknown;
}

/** Create a Cybersource (card) PayLink and return its id + hosted URL. */
export async function createPayLink(
  token: string,
  input: CreatePayLinkInput,
): Promise<PayLink> {
  const terminalId = required('TERMINAL_ID');
  const transactingMid = required('TRANSACTING_MID');
  const collectorName = poketSecret('COLLECTOR_NAME') ?? 'RutaRentable';
  const collectorPhoto = poketSecret('COLLECTOR_PHOTO');

  const body: Record<string, unknown> = {
    amount: input.amount,
    currency: input.currency,
    max_tries: input.maxTries ?? 5,
    description: input.description,
    methods: ['Cybersource'],
    expiration_date: input.expirationDate,
    collector_display_name: collectorName,
    configurations: [
      {
        method: 'Cybersource',
        configuration: {
          terminal_id: terminalId,
          transacting_mid: transactingMid,
          ...(input.callbackUrl ? { callback_url: input.callbackUrl, callback_time: 30 } : {}),
        },
      },
    ],
  };
  if (collectorPhoto) body.collector_photo = collectorPhoto;

  const res = await fetch(`${poketApiBase()}/api/v1/paylinks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-api-key': required('API_KEY'),
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Poket create paylink failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.id || !data.pay_link_url) {
    throw new Error(`Poket create paylink: unexpected response ${JSON.stringify(data)}`);
  }
  return { id: data.id, payLinkUrl: data.pay_link_url, status: data.status, raw: data };
}
