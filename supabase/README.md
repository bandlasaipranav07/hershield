# Supabase setup & RLS verification (HerShield)

This folder holds the database migration and the manual steps to connect the app to a
Supabase project.

## One-time setup (do together, ~10 minutes)

1. Create a free project at https://supabase.com/dashboard → "New project".
   (Suggested: region close to you, project name `hersheild-dev`, password stored
   somewhere safe — you won't need it for the app, only for the SQL editor.)
2. In the dashboard go to **SQL Editor**, open the `0001_init.sql` file from this
   folder, paste the whole script, and click **Run**. You should see success for all
   statements.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → goes into `app/.env` as `VITE_SUPABASE_URL`
   - `anon public` key → goes into `app/.env` as `VITE_SUPABASE_ANON_KEY`
4. Create `app/.env` (copy from `app/.env.example`), paste the two values. **Never
   commit `.env`** — it is gitignored.
5. `cd app && npm install && npm run dev` → register a test account, sign in, sign out.

> Only the **anon** key is used in the browser. The `service_role` key is never put in
> the frontend (see docs/PRIVACY.md).

## Applying the migration again

The migration uses plain `create table` / `create policy` statements, so it cannot be
re-run after it has already been applied. To reset a dev project: **SQL Editor → select
all → delete** the tables, then re-run `0001_init.sql`.

## RLS verification (do once after setup)

These checks prove the core security rule: **a user can only see/edit their own rows.**
The `anon` key must NOT be able to read anything, and a second user must NOT see a first
user's data.

Run the checks below in the SQL Editor first, then in the app:

### In the SQL Editor (auth bypass — verifies anon has no access)

```sql
-- Expect 0 rows: RLS blocks the anonymous role from reading
set role anon;
select count(*) from public.contacts;
set role postgres;
```

### In the browser (two real users)

1. Register `userA@example.com` and `userB@example.com`.
2. Sign in as A. Open DevTools console and run:

   ```js
   await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/contacts`, {
     headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${(await supabase.auth.getSession()).data.session.access_token}` },
   }).then((r) => r.json())
   ```

   You'll get an empty array (A has no contacts yet) — fine.

3. Sign in as B. Run the same snippet with B's session. Result must be `[]` — B cannot
   see A's data (this is the RLS cross-user isolation check).

> A fully automated RLS integration test (script that signs up two throwaway users and
> asserts isolation) is planned once the app has its own CI/test database — see
> docs/TESTING.md.