# Google Sign-In (Supabase Auth) — setup

MANEXA can show a **"Continue with Google"** button on `/login`. Google is used
only for the OAuth handshake via **Supabase Auth**; after Google returns, the
app bridges the verified email into its **existing session** (`manexa_session`).
It does **not** switch the app onto Supabase sessions and does **not** change
the database, tenancy, roles, or any business logic.

> **Who can sign in with Google:** only people whose Google email **already
> exists as an active Manexa user**. Unknown emails are rejected with a clear
> message — no account, tenant, or role is ever auto-created.

The button appears **only when** `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. Until then, `/login` is unchanged.

---

## 1. Google Cloud — create an OAuth Client ID

1. Go to <https://console.cloud.google.com/> → **create or select a project**.
2. **APIs & Services → OAuth consent screen**
   - User type: **External** (or Internal for a single Workspace).
   - Fill app name, support email, developer email. Add your domain under
     *Authorized domains*. Save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**.
   - **Authorized JavaScript origins** — add your app origins:
     - `http://localhost:3000` (development)
     - `https://<your-production-domain>` (production)
   - **Authorized redirect URIs** — add the **Supabase** callback (NOT the app):
     - `https://<your-project-ref>.supabase.co/auth/v1/callback`
     - This exact URL is shown in the Supabase dashboard (next step). Use it
       verbatim — do not invent a different callback.
4. Click **Create** and copy the **Client ID** and **Client Secret**.

---

## 2. Supabase — enable the Google provider

1. Open your project → **Authentication → Providers → Google**.
2. Toggle **Enabled**, then paste the **Client ID** and **Client Secret** from
   step 1. Save. The page also shows the **Callback URL**
   (`https://<project-ref>.supabase.co/auth/v1/callback`) — this is the value
   you put in Google's *Authorized redirect URIs*.
3. **Authentication → URL Configuration → Redirect URLs** — add the app's
   callback so Supabase is allowed to return the user to it:
   - `http://localhost:3000/auth/callback` (development)
   - `https://<your-production-domain>/auth/callback` (production)

---

## 3. App environment variables

Add these to `.env` (values from **Supabase → Project Settings → API**):

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon public key>"
```

- Only the **anon/public** key is needed — it is safe to expose to the browser.
- The **service-role key** and **Google Client Secret** are **never** placed in
  the app. The secret lives only in the Supabase dashboard.
- Restart the dev server / redeploy after setting these so the button appears.

---

## 4. Flow

```
Continue with Google → Supabase Auth (Google OAuth) → /auth/callback
  → exchange code for Supabase session → read verified email
  → find active Manexa user by email
       ├─ found  → mint existing manexa_session → redirect to the user's portal
       └─ none   → reject: "No Manexa account matches this Google email…"
```

## 5. Notes

- Sessions persist across refresh/navigation because they use the app's existing
  `manexa_session` cookie — nothing new to manage.
- Logout (`/login` logout button) clears both the app session and, best-effort,
  the Supabase session.
- No database, Prisma schema, RBAC, or multi-tenancy changes are involved.
