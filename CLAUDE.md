# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Start frontend (Vite :5173) + backend (Hono :3000)
bun run dev:backend  # Start backend only with hot reload
bun run db           # Start PostgreSQL and MinIO via Docker Compose
bun run build        # TypeScript check + Vite production build
bun run test         # Run all tests once
bun run test:watch   # Run tests in watch mode
bun run lint         # ESLint with auto-fix
bun run format       # Prettier on src/**/*.{ts,tsx}
bun run precommit    # Full pre-commit: lint + format + test
```

**Database:**
```bash
bunx prisma migrate dev    # Apply migrations and regenerate client
bunx prisma db push        # Push schema changes without migration file
bunx prisma studio         # Open Prisma Studio
bun run generate           # Seed sample data
bun run seed:printers      # Seed printer config
```

**Running a single test:**
```bash
bunx vitest run src/tests/your-test.test.ts
```

## Architecture

Full-stack TypeScript monorepo. **Bun** is the runtime and package manager. The API layer uses **tRPC** for end-to-end type safety between frontend and backend.

### Directory layout

- `src/` — React frontend (Vite)
- `server/` — Hono backend entry point and scripts (`server/index.ts`)
- `src/server/` — tRPC routers, procedures, and server-side business logic
- `src/client/trpc.ts` — tRPC client configured to proxy through Vite (`/trpc`)
- `prisma/schema.prisma` — Single source of truth for the database schema

### Request flow

```
Browser → Vite proxy /trpc → Hono (:3000) → tRPC router → Prisma → PostgreSQL
                             └── /auth → Better Auth
                             └── /api  → External REST API (external-api.ts)
                             └── /metrics → Prometheus metrics
                             └── /mcp  → MCP endpoint for AI integrations
```

### Authorization model

Four tRPC procedure tiers in `src/server/trpc.ts`:

- `publicProcedure` — no auth
- `userProcedure` — any authenticated user
- `adminProcedure` — admin role required
- `kioskProcedure` — kiosk session token

### Key modules

| Module | Routers/Files |
|--------|--------------|
| Asset management | `item`, `consumable`, `tag`, `location` |
| Users & groups | `user`, `group` |
| Transactions | `itemRecord`, `consumableRequest`, `auditLog` |
| Printing | `print`, `printQueue`, `printStats` + `src/server/lib/` (Bambu, Prusa) |
| AI chat | `chat` (LangChain + Ollama) |
| Notifications | `notification` |
| Kiosk | `kiosk` + `src/contexts/KioskContext.tsx` |
| Shopping cart | `src/contexts/CartContext.tsx` |

### Frontend patterns

- Pages live in `src/pages/`, registered in `src/App.tsx`
- Data fetching uses TanStack Query via tRPC hooks (`trpc.router.procedure.useQuery()`)
- Forms use React Hook Form + Zod validation
- UI components use Radix UI primitives with shadcn/ui (`components.json`)
- `src/components/data-table/` contains a reusable table component used across most list views

### Infrastructure

- **PostgreSQL** on port 5435 (Docker), managed by Prisma
- **MinIO** on ports 9000/9001 — S3-compatible object storage for images and G-code files
- **Ollama** — local LLM for AI chat feature
- **Bambuddy** — external service for Bambu Lab printer queue management
- Docker Compose runs postgres + minio; the app itself runs locally via `bun run dev`

### Environment

Copy `.env.example` to `.env`. Required variables include database URL, MinIO credentials, Better Auth secret, and optionally Ollama/Bambu endpoints.

### TypeScript paths

`@/*` resolves to `./src/*` (configured in `tsconfig.json` and `vite.config.ts`).
