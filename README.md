# Kostnad

Personal expense tracking application. Upload bank transaction exports, categorize spending, and visualize financial trends.

## Stack

| Category      | Technology                               |
| ------------- | ---------------------------------------- |
| Framework     | Next.js 16 (App Router, Turbopack)       |
| Language      | TypeScript 5                             |
| Functional    | Effect-TS                                |
| Database      | PostgreSQL via Drizzle ORM + @effect/sql |
| Auth          | better-auth (Email OTP, passwordless)    |
| Email         | Resend                                   |
| AI            | Anthropic Claude (claude-haiku-4-5)      |
| Notifications | Telegram                                 |
| Styling       | Tailwind CSS 4                           |
| Testing       | Vitest + Playwright                      |

## Features

- **Transaction uploads** - Import XLSX bank exports
- **Category management** - Create/edit expense categories
- **Merchant mappings** - Auto-categorize by merchant patterns
- **AI category suggestions** - Claude suggests categories for new merchants
- **Dashboard** - Income/expense summaries with period comparisons
- **Trend analysis** - Period-over-period and year-over-year changes
- **Upcoming expenses** - Detect recurring charges

## Getting Started

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment:**

   ```bash
   cp .env.example .env.local
   cp .env.example .env.test   # For e2e tests (use a separate test database)
   ```

   | File         | Purpose                                                 |
   | ------------ | ------------------------------------------------------- |
   | `.env.local` | Development - used by Next.js, Drizzle, Vitest          |
   | `.env.test`  | E2E tests - used by Playwright (separate test database) |

   Both files are gitignored.

3. **Run development server:**
   ```bash
   pnpm dev
   ```

## Project Structure

```
lib/
├── core/                    # Core business logic
│   ├── transaction/         # Upload parsing, queries, categorization
│   ├── category/            # Category CRUD actions
│   └── errors/              # Shared domain errors
├── services/                # Infrastructure services
│   ├── auth/                # Authentication (better-auth)
│   ├── db/                  # Database (Drizzle + Effect SQL)
│   ├── email/               # Email (Resend)
│   ├── anthropic/           # AI (Claude claude-haiku-4-5-20251001)
│   ├── telegram/            # Telegram notifications
│   └── activity/            # Activity logging
├── layers.ts                # Effect layer composition
└── next-effect/             # Next.js + Effect utilities

app/
├── (auth)/                  # Auth routes (login, OTP)
├── (dashboard)/             # Protected routes
│   ├── page.tsx             # Dashboard with summaries
│   ├── transactions/        # Transaction list & filtering
│   ├── categories/          # Category management
│   ├── upload/              # File upload
│   └── review/              # Uncategorized transaction review
└── api/
    └── auth/[...all]/       # Auth API handler
```

## Database

Schema is defined in `lib/services/db/schema.ts`. Migrations are stored in `lib/services/db/migrations/`.

### Development

Use `db:push` for rapid iteration - applies schema changes directly without migration files:

```bash
pnpm db:push
```

### Production

Use `db:generate` to create migration files, then apply them:

```bash
pnpm db:generate  # Creates migration files from schema changes
pnpm db:push      # Applies migrations to database
```

### Workflow

1. Edit `lib/services/db/schema.ts`
2. Run `pnpm db:generate` to create migration
3. Review generated migration in `lib/services/db/migrations/`
4. Run `pnpm db:push` to apply
5. Commit migration files

### Drizzle Studio

```bash
pnpm db:studio  # Opens GUI to browse/edit data
```

## Patterns

### Effect in Pages

```typescript
async function Content() {
  await cookies()

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const session = yield* getSession()
      const data = yield* getTransactionSummary(dateRange)
      return <div>{/* render data */}</div>
    }).pipe(
      Effect.provide(Layer.mergeAll(AppLayer)),
      Effect.scoped,
      Effect.matchEffect({
        onFailure: error =>
          Match.value(error._tag).pipe(
            Match.when('UnauthenticatedError', () => NextEffect.redirect('/login')),
            Match.orElse(() => Effect.succeed(<ErrorPage />))
          ),
        onSuccess: Effect.succeed
      })
    )
  )
}
```

### Server Actions

```typescript
// lib/core/category/create-category-action.ts
'use server'

export const createCategoryAction = async (name: string) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const session = yield* getSession()
      // ... create category
    }).pipe(
      Effect.withSpan('action.category.create'),
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
