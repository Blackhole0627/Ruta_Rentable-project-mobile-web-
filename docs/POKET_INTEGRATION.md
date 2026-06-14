# LAFISE Poket — automatic card payments

Drivers pay for a subscription with a credit/debit card through LAFISE **Poket**
(PayLinks API). On a successful payment Poket calls our webhook and the
subscription is activated automatically — no admin approval needed.

Source of truth for the API: the docs LAFISE shared (saved in
`docs/lafise docs.txt`) and <https://apidocs.lafise.com/v2.0/reference/api-overview>.

---

## How it works

```
Driver taps "Pagar con tarjeta"
   │
   ▼
poket-create-link  (Edge Function, runs as the driver)
   ├─ OAuth2 client_credentials → access token
   ├─ POST /api/v1/paylinks  → { id, pay_link_url }
   ├─ INSERT payments row  (status 'pending', external_link_id = id)
   └─ returns pay_link_url
   │
   ▼
Browser redirects to  https://<qa.|>pagoconpoket.com/payment/<id>
   │  driver enters card, Poket processes it
   ▼
poket-webhook  (Edge Function, called by Poket — service role)
   ├─ verify shared secret  (reject fakes)
   ├─ StartPayment  → 200 OK (allow)  /  400 (reject)
   └─ FinishPayment
        ├─ status 'Authorized' → payment 'confirmed' + user 'active'
        └─ status 'Failed'     → payment 'rejected' + notify
```

Subscription **expiry** is unchanged: the client recomputes it from the last
confirmed payment + the plan's `durationDays` (see `useSubscriptionStore`), so
the webhook only flips `status`/`current_plan`.

**Recurring = a new link each month.** Poket's API has no native subscription
object; when a plan lapses the driver just taps pay again and gets a fresh link.

---

## Answers to the open questions

**1. Webhook security — signature or secret?**
There is **no HMAC signature** on the payload. Poket authenticates *to* our
webhook with a shared credential we configure with the bank — Basic auth,
OAuth2 client-credentials, or an API key (docs: *"Se soporta autenticación Basic
y OAuth2 con client credentials, y API KEY"*). `poket-webhook` verifies it on
every call (`x-api-key`/`x-webhook-secret` header **or** HTTP Basic) and returns
401 otherwise. **Agree the exact credential + header with LAFISE and set the
matching secret before go-live.**

**2. Fees per transaction + settlement timing.** Not in the API docs — these are
commercial terms. Ask the LAFISE Poket Corporate Banking team. Settlement goes
to the merchant account tied to the `transacting_mid`/terminal (the LAFISE
account), so confirm that account + the payout schedule with them.

**3. Recurring.** No native subscriptions in the API. We create a new PayLink per
cycle (implemented).

**4. QA → production switch.** Separate credentials, selected by `POKET_ENV`
(`qa` | `prod`). Each secret resolves `POKET_<NAME>_<ENV>` first, then
`POKET_<NAME>`. Go-live steps below.

---

## One-time setup

### 1. Database
Run `supabase/sql/poket_payments.sql` against **both** the QA and prod Supabase
projects (adds `provider`, `external_link_id`, `external_payment_id`,
`provider_status`, `checkout_url` to `payments` + a unique index).

### 2. Secrets (Edge Functions)
Get from the LAFISE Corporate Banking team: `client_id`, `secret`, `api key`,
`terminal_id`, `transacting_mid`, the prod API host, and the agreed webhook
credential.

```bash
supabase secrets set POKET_ENV=qa

# Poket API credentials (set the _QA pair now, the _PROD pair before go-live)
supabase secrets set POKET_CLIENT_ID_QA=...        POKET_CLIENT_SECRET_QA=...
supabase secrets set POKET_API_KEY_QA=...
supabase secrets set POKET_TERMINAL_ID_QA=...      POKET_TRANSACTING_MID_QA=...
# QA host is built-in; for prod set the real host:
# supabase secrets set POKET_API_BASE_PROD=https://poket-api.lafise.com

# Branding shown on the Poket checkout
supabase secrets set POKET_COLLECTOR_NAME="RutaRentable"
supabase secrets set POKET_COLLECTOR_PHOTO="https://<cdn>/logo.png"   # optional, public URL

# Where Poket returns the payer after an attempt (your app's subscription page)
supabase secrets set POKET_RETURN_URL="https://app.rutarentable.com/suscripcion"

# Webhook auth — whatever LAFISE is configured to send (set at least one):
supabase secrets set POKET_WEBHOOK_SECRET=<long-random-string>           # header style
# or Basic:
# supabase secrets set POKET_WEBHOOK_BASIC_USER=... POKET_WEBHOOK_BASIC_PASS=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected by
Supabase automatically.

### 3. Deploy the functions
```bash
supabase functions deploy poket-create-link
supabase functions deploy poket-webhook --no-verify-jwt   # Poket has no Supabase JWT
```

### 4. Register the webhook + whitelist IPs with LAFISE
- Give LAFISE the webhook URL:
  `https://<project-ref>.supabase.co/functions/v1/poket-webhook`
  and the credential they should send (must match the secret above).
- **IP whitelist:** Poket requires the *caller's* IP to be whitelisted. Supabase
  Edge Functions egress from a range of IPs that LAFISE must allow. ⚠️ **This is
  the main go-live blocker — confirm with LAFISE how they want the outbound IP
  handled** (whitelist Supabase's ranges, or front the calls with a static-egress
  proxy). Until it's sorted, create-link calls from QA may be blocked.

---

## Testing (QA)

QA checkout cards (from the docs) — the **amount** drives the simulated result:

| Scenario              | Card                | Amount  | Exp   | CVV |
|-----------------------|---------------------|---------|-------|-----|
| Approved              | 4111 1111 1111 1111 | 1000.00 | 12/30 | 123 |
| Insufficient funds    | 4111 1111 1111 1111 | 4051.00 | 12/30 | 123 |
| Expired card          | 4111 1111 1111 1111 | 4054.00 | 12/30 | 123 |
| Stolen/lost card      | 4111 1111 1111 1111 | 4004.00 | 12/30 | 123 |
| Credit limit exceeded | 4111 1111 1111 1111 | 4061.00 | 12/30 | 123 |
| Invalid CVV           | 4111 1111 1111 1111 | 0.00    | 12/30 | 002 |

> Note: to hit the "approved" amount you may want a temporary QA plan priced at
> `1000` NIO, since the processor keys the result off the amount.

Checklist:
1. Tap **Pagar con tarjeta** → redirected to `qa.pagoconpoket.com/payment/<id>`.
2. A `payments` row exists: `status='pending'`, `provider='poket'`,
   `external_link_id` set.
3. Pay with the **approved** card → `poket-webhook` flips the row to `confirmed`,
   the user to `active`, and a "Pago aprobado" notification appears.
4. Pay with a **declined** card → row `rejected`, user unchanged, "Pago
   rechazado" notification.
5. Re-send the same FinishPayment → webhook returns `idempotent: true`, no double
   activation.

Local dev (mock backend, no Supabase): the checkout is **simulated instantly** —
"Pagar con tarjeta" activates the plan immediately so the UI flow is testable
without Poket.

---

## Go-live (prod)

1. Run the SQL on the prod project.
2. Set the `_PROD` secrets (`POKET_CLIENT_ID_PROD`, `…SECRET_PROD`,
   `…API_KEY_PROD`, `…TERMINAL_ID_PROD`, `…TRANSACTING_MID_PROD`,
   `POKET_API_BASE_PROD`) — using the **production** merchant + ecommerce
   terminal that settles to the LAFISE account.
3. `supabase secrets set POKET_ENV=prod`.
4. Point `POKET_RETURN_URL` at the production app URL.
5. Register the **prod** webhook URL + credential with LAFISE; whitelist the prod
   egress IP.
6. Remove `POKET_WEBHOOK_ALLOW_INSECURE` if it was ever set.
7. Re-deploy both functions and run one real low-value end-to-end payment.

---

## Files

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/poket.ts` | OAuth token + create-PayLink + env/secret resolver |
| `supabase/functions/poket-create-link/index.ts` | Creates the link, records the pending payment |
| `supabase/functions/poket-webhook/index.ts` | Verifies + handles Start/Finish events |
| `supabase/sql/poket_payments.sql` | `payments` columns + index |
| `apps/web/src/core/store/useSubscriptionStore.ts` | `startPoketCheckout` |
| `apps/web/src/modules/subscription/pages/SubscriptionPage.tsx` | "Pagar con tarjeta" UI |
