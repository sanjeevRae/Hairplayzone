# Hairplay-Zone

Hairplay-Zone is a demo beauty-salon website and AI-powered chatbot described in `idea.md` (see the project brief). It includes a Next.js frontend, a lightweight chat widget, API routes for appointment management, and a Supabase schema for reservations.

Goals:
- Fast, responsive landing page with clear CTAs.
- Guest booking flow (no account required).
- Natural-language chatbot that uses Groq sparingly.

- Backend validation + Supabase for data storage.

Quick start (local):

```bash
# Node 18+ recommended
npm install
npm run dev
```

Environment variables:
- `GROQ_API_KEY` - required for Groq-powered free-form replies.
- `GROQ_MODEL` - optional, defaults to `llama-3.3-70b-versatile`.

- `SUPABASE_URL` - your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` - server-side key used by the API route.

Create a local `.env.local` file with those values before running the app.

Supabase setup:
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy the project URL and service role key into `.env.local`.
4. Restart the dev server after changing environment variables.

Project layout:
- `pages/` — Next.js pages and API routes
- `components/` — UI components (chat widget)
- `src/` — application source
- `public/` — static assets
- `styles/` — CSS (Tailwind-ready)
- `docs/` — design and architecture notes
- `supabase/schema.sql` — DB schema

See `idea.md` for the full project brief.
