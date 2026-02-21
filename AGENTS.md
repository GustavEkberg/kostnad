# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-25
**Branch:** main

## OVERVIEW

**Kostnad** - Personal expense tracking application built with Next.js 16 App Router, Effect-TS service architecture, Drizzle ORM (PostgreSQL/Neon), better-auth authentication, nuqs URL state management, and Tailwind CSS 4.

**Mobile-first design required** - all UI must be responsive and work well on mobile devices.

## CRITICAL RULES

- **Use `pnpm` exclusively** - not npm or yarn
- **Run `pnpm tsc` before finishing** - ensure types pass
- **Run `pnpm lint` to check for errors** - fix any issues
- **Run `pnpm test:run` to verify tests pass** - fix failures before committing

### Effect-TS Rules (Enforced by ESLint)

| Rule                                            | Description                                           |
| ----------------------------------------------- | ----------------------------------------------------- |
| `local/no-disable-validation`                   | NEVER use `{ disableValidation: true }`               |
| `local/no-catch-all-cause`                      | NEVER use `Effect.catchAllCause` - catches defects    |
| `local/no-schema-from-self`                     | NEVER use `*FromSelf` schemas (use standard variants) |
| `local/no-schema-decode-sync`                   | NEVER use sync decode/encode (throws exceptions)      |
| `local/prefer-option-from-nullable`             | Use `Option.fromNullable()` instead of ternary        |
| `@typescript-eslint/no-explicit-any`            | NEVER use `any` type                                  |
| `@typescript-eslint/consistent-type-assertions` | NEVER use `as` type casts                             |

See `specs/EFFECT_BEST_PRACTICES.md` for detailed explanations and alternatives.

## SPECIFICATIONS

**Before implementing any feature, consult `specs/README.md`.**

- **Specs describe intent; code describes reality.** Check the codebase first before assuming something is/isn't implemented.
- **Use specs as guidance.** Follow patterns, types, and architecture defined in relevant specs.

## STRUCTURE

```
kostnad/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth route group (login, OTP)
│   ├── (dashboard)/        # Main app routes
│   │   ├── page.tsx        # Dashboard with summaries
│   │   ├── transactions/   # Transaction list & filtering
│   │   ├── categories/     # Category management
│   │   ├── upload/         # File upload
│   │   └── review/         # Uncategorized transaction review
│   └── api/                # API routes (auth catch-all)
├── components/ui/          # Modified shadcn/ui + custom components (see AGENTS.md)
├── lib/
│   ├── services/           # Effect-TS service layer (see AGENTS.md)
│   ├── core/               # Domain logic
│   │   ├── transaction/    # Upload parsing, queries, categorization
│   │   ├── category/       # Category CRUD actions
│   │   └── errors/         # Shared domain errors
│   ├── next-effect/        # Effect-TS/Next.js adapter
│   ├── schemas/            # Validation schemas
│   ├── layers.ts           # AppLayer composition
│   └── utils.ts            # Utilities (cn helper)
```

## WHERE TO LOOK

| Task                 | Location                                             | Notes                                       |
| -------------------- | ---------------------------------------------------- | ------------------------------------------- |
| Add server action    | `lib/core/[domain]/*-action.ts`                      | One action per file, see DATA_ACCESS spec   |
| Add domain function  | `lib/core/[domain]/*.ts`                             | Pure Effect functions for business logic    |
| Add new service      | `lib/services/[name]/`                               | Follow `lib/services/AGENTS.md` pattern     |
| Add dynamic page     | `app/*/page.tsx`                                     | See PAGE_PATTERNS spec for Suspense pattern |
| Add API route        | `app/api/[route]/route.ts`                           | Only for webhooks/external APIs             |
| Add UI component     | `components/ui/`                                     | Uses Base UI, not Radix                     |
| Add tests            | `lib/core/[domain]/*.test.ts`                        | Colocated with source, use @effect/vitest   |
| Database schema      | `lib/services/db/schema.ts`                          | Drizzle ORM                                 |
| Auth flow            | `app/(auth)/`                                        | better-auth + OTP email                     |
| Service dependencies | `lib/layers.ts`                                      | AppLayer merges all services                |
| Error types          | `lib/core/errors/index.ts`                           | Shared domain errors                        |
| Transaction uploads  | `lib/core/transaction/upload-transactions-action.ts` | Direct FormData upload                      |
| Transaction queries  | `lib/core/transaction/queries.ts`                    | Summaries, trends, upcoming expenses        |
| Category CRUD        | `lib/core/category/*-action.ts`                      | Create/update/delete categories             |
| URL state (filters)  | `app/*/search-params.ts`                             | nuqs/server imports only, see NUQS spec     |

## CODE MAP

| Symbol                  | Type     | Location                               | Role                                      |
| ----------------------- | -------- | -------------------------------------- | ----------------------------------------- |
| `AppLayer`              | Layer    | `lib/layers.ts:10`                     | Merged service layer for Effect pipelines |
| `NextEffect.runPromise` | Function | `lib/next-effect/index.ts`             | Handles redirects outside Effect context  |
| `Auth`                  | Service  | `lib/services/auth/live-layer.ts`      | Authentication (sign in/up/out, sessions) |
| `Db`                    | Service  | `lib/services/db/live-layer.ts`        | Database (returns Drizzle client)         |
| `Email`                 | Service  | `lib/services/email/live-layer.ts`     | Resend email sending                      |
| `AI`                    | Service  | `lib/services/anthropic/live-layer.ts` | Anthropic Claude (claude-haiku-4-5)       |
| `Telegram`              | Service  | `lib/services/telegram/live-layer.ts`  | Telegram bot notifications                |
| `Activity`              | Service  | `lib/services/activity/live-layer.ts`  | Activity logging via Telegram             |

## DOMAIN MODELS

| Table             | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `transaction`     | Individual bank transactions               |
| `category`        | Expense/income categories                  |
| `merchantMapping` | Patterns to auto-categorize by merchant    |
| `upload`          | Tracks uploaded files & transaction counts |
| `user`            | User accounts                              |

## CONVENTIONS

### Code Style (Prettier)

- **Semicolons**
- **No trailing commas**
- Single quotes, 2-space indent, max 100 chars

### File Naming

- **All files use kebab-case** - `search-params.ts`, `post-list.tsx`, `live-layer.ts`
- **Server actions** end in `-action.ts` - `delete-category-action.ts`
- **URL state definitions** - `search-params.ts` in the route directory

### Effect-TS Service Pattern

```typescript
// Services use static layer/Live properties for v4 compatibility
export class ServiceName extends Effect.Service<ServiceName>()('@app/ServiceName', {
  effect: Effect.gen(function* () {
    /* ... */
  })
}) {
  static layer = this.Default;
  static Live = this.layer.pipe(Layer.provide(ConfigLive));
}
```

### Configuration

- **Always** use `Config.string('VAR')` or `Config.redacted('SECRET')`
- **Never** use `process.env` directly with throws

### Observability

- All service methods: `Effect.withSpan('Service.method')`
- Error logging: `Effect.tapError()`
- Span attributes: `Effect.annotateCurrentSpan()`

### Imports

- Use `@/` path alias for project imports
- **No barrel files** - import directly from source files
- Import services from `live-layer.ts` directly

## ANTI-PATTERNS (THIS PROJECT)

| Pattern                               | Correct Approach                                      |
| ------------------------------------- | ----------------------------------------------------- |
| API routes for CRUD operations        | Server actions (`lib/core/[domain]/*-action.ts`)      |
| `process.env.X` with throws           | `yield* Config.string('X')`                           |
| `router.push()` for logout            | `window.location.href = '/'` (layout cache issue)     |
| Barrel files (`index.ts` re-exports)  | Import from `live-layer.ts` directly                  |
| `Effect.runPromise()` in pages        | `NextEffect.runPromise()` (handles redirects)         |
| Layer `dependencies` option           | `Layer.provide()` externally (v4 compat)              |
| Multiple services per directory       | One service per directory                             |
| Multiple actions per file             | One action per file ending in `-action.ts`            |
| `useState` for shareable UI state     | nuqs URL state (`app/*/search-params.ts`)             |
| Import `parseAs*` from `nuqs`         | Import from `nuqs/server` in search-params.ts         |
| Direct data fetch in page component   | Suspense + Content pattern (see PAGE_PATTERNS spec)   |
| Nested Suspense with async components | Single Content component fetches all data             |
| Missing `export const dynamic`        | Add `export const dynamic = 'force-dynamic'` for auth |

## UNIQUE STYLES

### Next.js + Effect Integration

Pages use `NextEffect.runPromise()` which catches `RedirectError` and calls `redirect()` outside the Effect context. This is required because Next.js redirects must be called outside try-catch.

### UI Components

Uses **Base UI** (`@base-ui/react`) primitives instead of Radix UI. Components are shadcn-styled but built on a different foundation. See `components/ui/AGENTS.md`.

### Service Dependency Hierarchy

```
AppLayer
├── Auth.Live → Email.Live
├── Db.Live
├── AI.Live
├── Telegram.Live
└── Activity.Live → Telegram.Live
```

### Data Access Patterns

See `specs/DATA_ACCESS_PATTERNS.md` for full details. Summary:

| Operation            | Pattern       | Location                                             |
| -------------------- | ------------- | ---------------------------------------------------- |
| Read data for pages  | RSC           | `app/*/page.tsx`                                     |
| Create/Update/Delete | Server Action | `lib/core/[domain]/*-action.ts`                      |
| File upload          | FormData      | `lib/core/transaction/upload-transactions-action.ts` |
| External webhooks    | API Route     | `app/api/webhooks/*/route.ts`                        |

**Server Action Pattern:**

```typescript
// lib/core/category/delete-category-action.ts
'use server'

export const deleteCategoryAction = async (categoryId: Category['id']) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const session = yield* getSession()
      yield* deleteCategory(categoryId)
    }).pipe(
      Effect.withSpan('action.category.delete'),
      Effect.provide(AppLayer),
      Effect.scoped,
      Effect.matchEffect({
        onFailure: error => /* handle errors */,
        onSuccess: () => Effect.sync(() => revalidatePath('/categories'))
      })
    )
  )
}
```

## NOTES

- **No CI/CD configured** - deployment via Vercel auto-deploy
- **React Compiler enabled** - automatic memoization (experimental)
- **Drizzle beta** - using `1.0.0-beta.11`, may have breaking changes
- Effect v4 migration: services designed for easy `Effect.Service` → `ServiceMap.Service` transition

## SUBDIRECTORY DOCS

- `lib/services/AGENTS.md` - Effect-TS service architecture patterns
- `components/ui/AGENTS.md` - UI component patterns and customizations
