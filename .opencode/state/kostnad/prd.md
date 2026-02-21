# PRD: Kostnad (Household Finance Tracker)

**Date:** 2026-01-25

---

## Problem Statement

### What problem are we solving?

Manual tracking of household expenses provides no actionable insights. Users can't answer basic questions like:

- "How much did we spend on groceries this month vs last month?"
- "What's our average monthly restaurant spending?"
- "Is car insurance coming up soon?" (based on historical yearly patterns)

Without visibility into spending patterns, couples can't make informed financial decisions or anticipate upcoming large expenses.

### Why now?

User has accumulated bank transaction data and wants to start gaining insights immediately. The existing bank export workflow (manual Excel export) is sufficient for data input.

### Who is affected?

- **Primary users:** Household partners (2 users) who share finances and want joint visibility into spending patterns
- **Access model:** Separate logins via OTP email auth, shared data view

---

## Proposed Solution

### Overview

A web app that imports Handelsbanken Excel transaction exports, auto-categorizes transactions, and displays spending insights with monthly/weekly/yearly views. The app detects recurring expenses from historical patterns and surfaces upcoming large expenses.

### User Experience

#### User Flow: Upload Transactions

1. User logs in via OTP email
2. User clicks "Upload transactions"
3. User selects Handelsbanken Excel file
4. App parses file, extracts transactions
5. App auto-categorizes known merchants, flags unknowns for review
6. User reviews flagged transactions, assigns categories
7. Transactions merge into database (deduped by date + amount + merchant)

#### User Flow: View Insights Dashboard

1. User sees monthly spending overview (default view)
2. Cards show: Total spent, Total income, Net, Top categories
3. User can switch timeframe: Week / Month / Year
4. User can drill into specific category to see transactions
5. "Upcoming expenses" section shows predicted large expenses based on historical yearly patterns

#### User Flow: Review Uncategorized

1. App shows list of transactions needing categorization
2. For each: merchant name, amount, date, suggested category (if any)
3. User selects category from dropdown or creates new
4. Category mapping saves for future auto-categorization

### Design Considerations

- **Visual style:** Clean, minimalistic like Vercel's aesthetic (light mode default, dark mode supported)
- Monochrome with subtle grays, sharp typography, generous whitespace
- Mobile-friendly (partners may check on phones)
- Simple dashboard, not overwhelming
- Clear visual hierarchy: big numbers for totals, lists for details

---

## End State

When this PRD is complete, the following will be true:

- [ ] Users can authenticate via OTP email (existing better-auth)
- [ ] Users can upload Handelsbanken Excel files
- [ ] Transactions are parsed, deduplicated, and stored
- [ ] Transactions are auto-categorized by merchant name mapping
- [ ] Unknown merchants are flagged for manual categorization
- [ ] Dashboard shows spending by category for selected timeframe
- [ ] Dashboard shows income vs expenses comparison
- [ ] Dashboard shows month-over-month and year-over-year trends
- [ ] Dashboard predicts upcoming large expenses from historical patterns
- [ ] All data is shared between authenticated household users

---

## Success Metrics

### Quantitative

| Metric                                             | Current                      | Target                     | Measurement Method |
| -------------------------------------------------- | ---------------------------- | -------------------------- | ------------------ |
| Time to answer "how much on groceries this month?" | Minutes (manual spreadsheet) | Seconds (one click)        | User feedback      |
| % transactions auto-categorized                    | 0%                           | >80% after 2 months of use | DB query           |

### Qualitative

- Users feel confident about spending patterns
- Users are not surprised by upcoming large expenses

---

## Acceptance Criteria

### Feature: Transaction Upload

- [ ] Accepts `.xlsx` files matching Handelsbanken export format
- [ ] Parses header rows correctly (account info, date range)
- [ ] Extracts: date, merchant/text, amount, running balance
- [ ] Deduplicates across uploads only (allows duplicates within same file)
- [ ] Dedupe key: date + merchant + amount (ignores if already exists from different upload)
- [ ] Handles multiple uploads over time (weekly/monthly cadence)
- [ ] Positive amounts treated as income (including refunds - no special handling)
- [ ] Negative amounts treated as expenses
- [ ] Focus is on net cash flow, not individual transaction semantics

### Feature: Category Management

- [ ] Default categories: Groceries, Restaurants, Transport, Utilities, Entertainment, Shopping, Health, Travel, Other
- [ ] Users can create/edit/delete categories
- [ ] Merchant-to-category mapping persists
- [ ] New merchants get "best guess" category based on name patterns (e.g., "ICA" → Groceries)
- [ ] Uncategorized transactions appear in review queue
- [ ] User can reassign category for any transaction
- [ ] Reassignment updates merchant mapping for future transactions

### Feature: Dashboard - Overview

- [ ] Shows total income for period
- [ ] Shows total expenses for period
- [ ] Shows net (income - expenses)
- [ ] Shows breakdown by category (bar chart or list)
- [ ] Default view: current month
- [ ] Can switch to: this week, this year
- [ ] Can navigate to previous periods

### Feature: Dashboard - Trends

- [ ] Month-over-month comparison for selected category
- [ ] Year-over-year comparison (e.g., Jan 2026 vs Jan 2025)
- [ ] Visual indicator: up/down vs previous period

### Feature: Upcoming Expenses

- [ ] Detects yearly recurring expenses (e.g., car insurance in March)
- [ ] Detection based on: same merchant, similar amount (±20%), ~12 months apart
- [ ] Shows: merchant name, expected amount, expected date, days until due
- [ ] Only shows expenses in next 60 days

### Feature: Authentication

- [ ] OTP email login (existing better-auth setup)
- [ ] Users table already exists
- [ ] All authenticated users see all household data (no per-user isolation)

---

## Technical Context

### Existing Patterns

- Server actions: `lib/core/post/create-post-action.ts` - follow this pattern for transaction actions
- Page structure: `app/page.tsx` - Suspense + Content pattern for data fetching
- URL state: `app/search-params.ts` - nuqs for timeframe selection
- File uploads: `lib/core/file/get-upload-url-action.ts` - S3 signed URL pattern

### Key Files

- `lib/services/db/schema.ts` - add new tables here
- `lib/layers.ts` - AppLayer composition (may not need changes)
- `lib/core/errors/index.ts` - add domain errors if needed
- `components/ui/` - existing components to use

### System Dependencies

- **xlsx parsing**: Need library to parse Excel files server-side (e.g., `xlsx`, `exceljs`, or `sheetjs`)
- **No external APIs**: All data from uploaded files

### Data Model Changes

New tables required:

```
transaction
- id: cuid
- date: date
- merchant: text (original text from bank)
- amount: decimal (negative = expense, positive = income)
- balance: decimal (running balance, nullable)
- categoryId: FK to category
- uploadId: FK to upload (for tracking source)
- createdAt, updatedAt

category
- id: cuid
- name: text (unique)
- icon: text (optional, for UI)
- isDefault: boolean
- createdAt, updatedAt

merchant_mapping
- id: cuid
- merchantPattern: text (e.g., "ICA", "MAXI ICA")
- categoryId: FK to category
- createdAt, updatedAt

upload
- id: cuid
- fileName: text
- uploadedBy: FK to user
- transactionCount: int
- dateRangeStart: date
- dateRangeEnd: date
- createdAt
```

---

## Risks & Mitigations

| Risk                                | Likelihood | Impact | Mitigation                                                                                           |
| ----------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Excel format changes                | Low        | High   | Parse defensively, surface errors clearly                                                            |
| Duplicate transactions on re-upload | High       | Medium | Dedupe across uploads only (same upload keeps duplicates); key = date + merchant + amount + uploadId |
| Merchant name variations            | High       | Medium | Fuzzy matching or user-correctable mappings                                                          |
| Large file uploads                  | Low        | Low    | Parse server-side after S3 upload                                                                    |

---

## Alternatives Considered

### Alternative 1: Bank API Integration (Tink, Plaid)

- **Pros:** Automatic transaction sync, no manual uploads
- **Cons:** Complex setup, ongoing API costs, privacy concerns
- **Decision:** Deferred. Manual Excel upload is sufficient for v1. Can add later.

### Alternative 2: CSV Import Instead of Excel

- **Pros:** Simpler parsing
- **Cons:** Bank exports .xlsx by default, extra step for user
- **Decision:** Rejected. Support native bank format for best UX.

### Alternative 3: Per-User Data Isolation

- **Pros:** Privacy between household members
- **Cons:** Defeats purpose of shared household view
- **Decision:** Rejected. This is explicitly a shared household tool.

---

## Non-Goals (v1)

Explicitly out of scope for this PRD:

- **Budgeting/spending limits** - no "you're over budget" alerts
- **Bill reminders with notifications** - only passive "upcoming expenses" display
- **Bank API integration** - manual upload only
- **Multi-account merging logic** - single data pool, no account tracking
- **Receipt scanning** - transactions only from bank data
- **Automatic categorization via AI/ML** - rule-based merchant mapping only
- **Export/reporting** - view-only in app

---

## Interface Specifications

### Pages

| Route           | Purpose                                 |
| --------------- | --------------------------------------- |
| `/`             | Dashboard with spending overview        |
| `/upload`       | Upload transaction file                 |
| `/review`       | Review uncategorized transactions       |
| `/transactions` | Full transaction list with filters      |
| `/categories`   | Manage categories and merchant mappings |

### Server Actions

| Action                                             | Purpose                         |
| -------------------------------------------------- | ------------------------------- |
| `uploadTransactionsAction(file)`                   | Parse Excel, store transactions |
| `categorizeTransactionAction(id, categoryId)`      | Assign category to transaction  |
| `createCategoryAction(name)`                       | Create new category             |
| `updateMerchantMappingAction(pattern, categoryId)` | Set merchant → category rule    |

---

## Open Questions

_All resolved during PRD creation._

---

## Appendix

### Handelsbanken Excel Format

Based on sample file `Handelsbanken_Account_Transactions_2026-01-25.xlsx`:

```
Row 1: "Handelsbanken", (empty cells)
Row 2: Date/time of export
Row 3: Empty
Row 4: Account name + number
Row 5: Empty
Row 6: Account type, Clearing number, Balance
Row 7: Period, Transaction type filter
Row 8: Empty
Row 9: Headers - Reskontradatum, Transaktionsdatum, Text, Belopp, Saldo
Row 10+: Transaction data
```

Fields:

- **Reskontradatum**: Settlement date
- **Transaktionsdatum**: Transaction date (use this)
- **Text**: Merchant/description
- **Belopp**: Amount (negative = expense, positive = income)
- **Saldo**: Running balance

### Sample Merchant → Category Mappings

| Pattern                       | Category         |
| ----------------------------- | ---------------- |
| ICA, MAXI ICA, HEMKÖP, COOP   | Groceries        |
| Restaura, BISTRO, Thai, Pizza | Restaurants      |
| PARKERING, EasyPark           | Transport        |
| GÖTEBORG ENERG                | Utilities        |
| Systembolaget                 | Entertainment    |
| Apotek, Kronans               | Health           |
| BAUHAUS, JYSK, HEMTEX         | Shopping         |
| HOTELL, Hotel                 | Travel           |
| OKQ8, St1, Circle K           | Transport (fuel) |

### Glossary

- **Merchant mapping**: Rule that assigns a category to transactions based on merchant name pattern
- **Settlement date (Reskontradatum)**: When bank processed the transaction
- **Transaction date (Transaktionsdatum)**: When purchase occurred
