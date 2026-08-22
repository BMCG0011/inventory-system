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
- Accessibility conventions: real `<a href>` for anything link-like, semantic `<nav>` for the sidebar, `cursor-pointer` on buttons, and page content rendered inside `<main id="main">` (the skip-nav link in `src/App.tsx` targets that id) — follow these for new UI

### Asset (Item) data model

- `Item.status` is an `ItemStatus` enum (`CHURCH_USE`, `STORED`, `IN_REPAIR`, `DISPOSED_OF`, `ON_LOAN`); display config/badge styling lives in `src/lib/item-status.tsx`. `Item.stored` and `Item.cost` are deprecated in favor of `status` and `costCents` — avoid using them in new code
- Monetary fields (`costCents`, `depreciatedValueCents`) are stored as integer cents; use `MoneyInput` (`src/components/inputs/money-input.tsx`) for currency entry, which converts to/from dollars for display
- Date fields (e.g. `purchasedAt`) use the `DatePicker`/`Calendar` components (`src/components/ui/`), backed by `date-fns` + `react-day-picker`
- `Location` is self-referential (`parentId`/`children`) for nested storage locations. `location.getPath` (tRPC) walks a location up to its root; the `useLocationPath` hook (`src/hooks/use-location.ts`) wraps it. Drill-down location pickers live in `src/components/item-crud/` (`LocationSelector`, `NestingLocation`, `CascadingLocation`)

### Production deployment

In production (Dockerfile / `bun run start`), the Hono backend on :3000 serves the built frontend directly via a small `Bun.file()`-based handler in `server/index.ts` (`serveFromDist`) — not `hono/bun`'s `serveStatic`, which was silently failing to match nested `/assets/*` paths and falling through to the SPA fallback for every asset request. Do not reintroduce `vite preview` as a production static server either — it isn't designed for that and was separately observed hanging under concurrent asset requests. The SPA fallback route (`app.get("*", () => serveFromDist("index.html"))`) must stay the last route registered in `server/index.ts`, since it's a terminal wildcard handler that would otherwise shadow any route registered after it.

Domain/TLS routing for each Dokploy deployment (production `dokploy.yml`, testing `dokploy-testing.yml`) is configured via Dokploy's **Domains GUI** (service `app`, container port 3000), not hardcoded Traefik labels in the compose files. Traefik's Docker provider scopes router/service names *globally*, not per Dokploy project — two deployments both hardcoding the same name (e.g. `inventory`) can silently merge into one shared load-balanced backend, which caused production and testing traffic to intermittently cross for an extended period. Enable **Isolated Deployment** for every app in Dokploy to avoid this.

### Infrastructure

- **PostgreSQL** on port 5435 (Docker), managed by Prisma
- **MinIO** on ports 9000/9001 — S3-compatible object storage for images and G-code files
- **Ollama** — local LLM for AI chat feature
- Docker Compose runs postgres + minio; the app itself runs locally via `bun run dev`

### Environment

Copy `.env.example` to `.env`. Required variables include database URL, MinIO credentials, Better Auth secret, and optionally Ollama/Bambu endpoints.

### TypeScript paths

`@/*` resolves to `./src/*` (configured in `tsconfig.json` and `vite.config.ts`).
