# readmorecode.dev

A web app for practicing code comprehension. It serves real-world source files from public GitHub
repositories as puzzles: you read a snippet, identify the line range that answers a question, and an
LLM grades your selection and explains the answer.

## Stack

- **Next.js 16** (App Router, React 19)
- **Drizzle ORM** over SQLite locally / **Turso** (libsql) in production
- **Groq** LLM API for puzzle generation and grading
- **GitHub API** for fetching repository trees and file contents
- **Stripe** for subscription billing
- Custom cookie-based auth (scrypt password hashing, SHA-256 session-token hashing)

## Getting started

```bash
bun install
cp .env.example .env.local   # then fill in the values
bun run db:migrate           # apply migrations to the database
bun run db:seed              # generate an initial set of puzzles (optional)
bun run dev                  # start the dev server on http://localhost:3000
```

## Environment

See [`.env.example`](./.env.example) for the full list. At minimum you need a `GROQ_API_KEY`, a
`GITHUB_TOKEN`, and a database (`DB_FILE_NAME` for local SQLite, or `TURSO_DB_URL` +
`TURSO_DB_AUTH_TOKEN` for Turso). Stripe and admin variables are required only for billing and the
admin dashboard.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Next.js dev server |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | Run ESLint |
| `bun run db:migrate` | Apply database migrations |
| `bun run db:seed` | Generate puzzles from GitHub repos via Groq |
| `bun run db:generate` | Generate a Drizzle migration from schema changes |
| `bun run db:push` | Push the schema directly to the database |
| `bun run db:repair` | Repair malformed stored puzzles |
| `bun run db:regenerate` | Regenerate puzzles |

## Project layout

- `app/` — App Router pages and API routes
- `components/` — React UI components
- `lib/` — server-side logic (auth, billing, grading, db access, GitHub/Groq clients)
- `lib/db/` — Drizzle schema and query helpers
- `drizzle/` — generated SQL migrations
- `scripts/` — database seeding and maintenance scripts
