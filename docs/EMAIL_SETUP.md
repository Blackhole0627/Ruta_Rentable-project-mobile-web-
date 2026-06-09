# Email setup — Resend SMTP + Supabase OTP codes

This app verifies sign‑ups and resets passwords with a **6‑digit code** sent by
email (no magic links). For that to work reliably you must:

1. Wire a real SMTP provider (**Resend**) into Supabase — the built‑in Supabase
   mailer is rate‑limited to a handful of messages per hour and is only meant
   for testing, which is why codes "stop arriving".
2. Turn **email confirmation ON**.
3. Make the email templates print the **`{{ .Token }}`** (the 6‑digit code)
   instead of only a link.

Everything below is dashboard configuration — no code changes are required; the
app already calls `verifyOtp(..., 'signup' | 'recovery')`.

---

## 1. Create a Resend account & get SMTP credentials

1. Sign up at <https://resend.com> (free tier ≈ 3,000 emails/month, 100/day).
2. **Domains → Add Domain** and add your domain (e.g. `rutarentable.com`).
   - Add the **SPF / DKIM** DNS records Resend shows you. Wait until it says
     **Verified** (gives the best deliverability — codes won't land in spam).
   - For a quick test you can skip this and send from `onboarding@resend.dev`,
     but real users should get a verified domain sender.
3. **API Keys → Create API Key** (name it `supabase-smtp`, permission *Sending
   access*). Copy the key — it looks like `re_xxxxxxxx`. You only see it once.

Resend SMTP connection values:

| Field    | Value                          |
| -------- | ------------------------------ |
| Host     | `smtp.resend.com`              |
| Port     | `465` (SSL) or `587` (STARTTLS)|
| Username | `resend`                       |
| Password | your API key (`re_…`)          |

---

## 2. Point Supabase Auth at Resend

Supabase Dashboard → **Project Settings → Authentication → SMTP Settings**
(also reachable at **Authentication → Emails → SMTP**):

1. Toggle **Enable Custom SMTP** ON.
2. Fill in:
   - **Sender email**: `no-reply@rutarentable.com` (must be on your verified
     domain, or `onboarding@resend.dev` for testing).
   - **Sender name**: `RutaRentable`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: your Resend API key
3. **Save**.

> Minimum interval / rate limits live under **Authentication → Rate Limits**.
> With custom SMTP you can raise "Emails per hour" well above the default.

---

## 3. Enable email confirmation

Supabase Dashboard → **Authentication → Providers → Email**:

- **Confirm email**: ON  ← makes `signUp` require verification (the app then
  asks for the 6‑digit code). With this OFF, sign‑up logs the user straight in.
- **Secure email change**: ON (recommended).
- Optional: **OTP expiry** ~ 3600 s, **OTP length** 6.

---

## 4. Make templates send the 6‑digit CODE

Supabase Dashboard → **Authentication → Emails → Templates**. By default these
templates only contain a `{{ .ConfirmationURL }}` link. Add `{{ .Token }}` so
the code is shown. Edit the three templates the app uses:

### Confirm signup

```html
<h2>Confirma tu cuenta en RutaRentable</h2>
<p>Tu código de verificación es:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Escríbelo en la app para activar tu cuenta. Caduca en 1 hora.</p>
```

### Reset password (Recovery)

```html
<h2>Restablece tu contraseña</h2>
<p>Usa este código para crear una nueva contraseña:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Si no fuiste tú, ignora este correo.</p>
```

### Magic Link (used by "Entrar con un código por correo")

```html
<h2>Tu código para entrar</h2>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Escríbelo en la app para iniciar sesión.</p>
```

> `{{ .Token }}` = the 6‑digit numeric code that `auth.verifyOtp` checks.
> Keep a link too if you like, but the app's flow only needs the code.

---

## 5. Redirect / URL config (only matters if you ever use links)

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your web origin (e.g. `https://app.rutarentable.com`).
- **Redirect URLs**: add the web origin and, for the Android build, the app
  scheme used by Capacitor.

The code‑based flow does **not** rely on redirects, so this is optional for
sign‑up/reset — it's only needed if you re‑enable magic‑link buttons.

---

## 6. Test checklist

- [ ] Create an account → a code email arrives within seconds → entering it logs in.
- [ ] "¿Olvidaste tu contraseña?" → code arrives → new password is accepted.
- [ ] "Entrar con un código por correo" → code arrives → logs in.
- [ ] Resend button is disabled for 30 s, then works.
- [ ] Codes no longer hit the old Supabase hourly rate limit.

### How it maps to the code

| App action                         | Supabase call                                  | Template          |
| ---------------------------------- | ---------------------------------------------- | ----------------- |
| Sign up                            | `auth.signUp` → `verifyOtp(type:'signup')`     | Confirm signup    |
| Forgot password                    | `resetPasswordForEmail` → `verifyOtp('recovery')` then `updateUser({password})` | Reset password |
| Email‑code login                   | `signInWithOtp` → `verifyOtp(type:'email')`    | Magic Link        |
| Resend (sign‑up)                   | `auth.resend({type:'signup'})`                 | Confirm signup    |

> **Local / offline (mock backend):** none of this is needed. The app runs
> against the Dexie mock with no network — sign‑up shows a demo banner and the
> universal code **`000000`** always verifies.

---

## 7. Welcome email after signup

A separate **welcome email** is sent once the user verifies their signup code.
It is NOT a Supabase auth template — it's an Edge Function that calls the Resend
API, invoked by the app right after a successful signup verification
(`backend.sendWelcomeEmail()` -> function `send-welcome`).

Setup (one time, needs the Supabase CLI):

```bash
# from the repo root
supabase functions deploy send-welcome

# secrets (server-side only - never in the frontend)
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set WELCOME_FROM="RutaRentable <noreply@tudominio.com>"
```

- `RESEND_API_KEY` - same Resend key as the SMTP password.
- `WELCOME_FROM` - optional; defaults to `RutaRentable <onboarding@resend.dev>`.
  For real users use a sender on your **verified** Resend domain.

The email body lives in [supabase/functions/send-welcome/index.ts](../supabase/functions/send-welcome/index.ts)
(Spanish, edit freely). It's best-effort: if the function isn't deployed, signup
still works - the welcome email just won't send (no error shown to the user).
On the offline mock backend it's a no-op.
