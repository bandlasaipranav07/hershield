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

## Migration safety

Treat `migrations/0001_init.sql` as the initial schema history. Review it and the RLS
policies before applying it to any project. Do not reset a hosted project or delete its
tables to make this migration rerunnable. For a schema change after the initial
migration, add a new, reviewed, forward migration and plan a rollback before applying it.

No hosted Supabase project was changed or verified during the current local hardening
work. A configured project, credentials, migration target, and a live RLS verification
were not part of that work.

## RLS verification (do once after setup)

These checks are a manual verification plan, not evidence that a hosted project has
passed. Review policies for every table and test with two distinct authenticated users.

Run the checks below only against a disposable test project or local Supabase instance:

### In the SQL Editor

```sql
-- Expect 0 rows: RLS blocks the anonymous role from reading
set role anon;
select count(*) from public.contacts;
set role postgres;
```

### In the app (two test users)

1. Register two test accounts in the disposable project.
2. Sign in as A and add a test contact and event through the app.
3. Sign out, sign in as B, and inspect the app's contacts and events. B must not see A's rows.
4. Sign back in as A and confirm A's rows are still present.

> The repository's unit tests mock Supabase and do not prove hosted RLS behavior. An
> automated RLS integration test still needs an isolated Supabase test project and CI
> credentials; do not point such tests at production data.
