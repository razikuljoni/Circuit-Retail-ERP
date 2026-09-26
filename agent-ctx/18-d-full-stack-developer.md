# Task 18-d — Real notification center (live header bell)

## What was built
- `src/app/api/notifications/route.ts` (NEW, GET, force-dynamic): compact alerts payload from **4 parallel Prisma queries** (select-only fields): active products findMany, open shift findFirst, `sale.groupBy(by:['status'])` over the Dhaka day window (ONE query → COMPLETED totals + REFUNDED count), expense aggregate. Window = `[startOfTodayUTC, +1d)` — byte-for-byte the same math as /api/dashboard's live "today" block. Output: `lowStock` ≤8 (stock>0 && ≤reorderLevel, sorted by stock/reorder **ratio asc**), `outOfStock` ≤8 (name asc), `openShift {id,openedAt,openedBy}|null`, `today {sales,transactions,expenses}` (round2), `refundedToday`, `generatedAt`.
- `src/components/app/notification-bell.tsx` (NEW): replaces the old static low-stock popover. Local `NotificationsData` interface (route types are not importable client-side in App Router — declared in the component per constraint). `useApi('/api/notifications', {pollMs:60_000})` + silent refetch on every popover open. Badge = lowStock+outOfStock+(openShift?1:0)+(refunds>0?1:0); Today row is info-only/uncounted; hidden at 0; "9+" cap; severity colors red→amber→emerald. Sections (uppercase headers + tinted icon chips): Out of stock (PackageX, red) → Products; Low stock (PackageOpen, amber) → Inventory; Shift (Clock, emerald) → POS; Today (TrendingUp, emerald) → Dashboard; Refunds (Undo2, red) → Sales. Rows = real buttons with aria-labels, hover:bg-muted/50, truncate, tabular-nums. Empty state "You're all caught up" (BellOff) when zero actionable; skeletons while loading; error state. Footer "Refreshed HH:MM" + RefreshCw icon button (900ms spin window; timer cleaned up on unmount).
- `src/components/app/app-header.tsx`: wire-in only — old 100-line NotificationsPopover + dead imports removed, `<NotificationBell />` in the same slot; theme toggle / search / clock untouched.

## Key decisions
- One `sale.groupBy(status)` instead of two aggregates; lowStock ratio sort puts closest-to-dry first; badge tone mirrors section tones (red if any OOS, amber if any low, emerald otherwise).
- Manual-refresh spinner: useApi's silent refetch exposes no in-flight state → fixed 900ms spin window (covers this endpoint's ~50ms round-trip). First implementation watched `generatedAt` in an effect → `react-hooks/set-state-in-effect` lint error → refactored to the timer approach.
- Mobile fit: `w-[340px] max-w-[calc(100vw-1rem)]` + Radix collision avoidance (measured left 38 / right 378 at 390px).

## Verification (all green)
- lint: 0 errors (1 pre-existing benign RHF warning in product-dialog.tsx, not my file). tsc: 0 errors in src/ (4 pre-existing in examples/ + skills/).
- curl: today.sales/transactions/expenses (12100/4/0) **exactly match** /api/dashboard (re-verified after concurrent POS QA raised them); lowStock matches /api/products?status=active (Ballpoint Pen Pack (10), 13 ≤ reorder 15, ratio 0.867); outOfStock/refunds/shift null all consistent.
- agent-browser E2E: badge "1" + popover rows → low-stock row click → #/inventory, popover closed, focus returned to bell; reopen refetches (network log); Refresh → request fired + "Refreshed 03:42 AM"→"03:43 AM" + animate-spin verified mid-flight; LIVE shift pickup while 18-c QA held a shift ("Shift open · 0m / by QA 18c Cashier", badge 2 = rows); Escape closes + focus on bell; 390px popover fits; dark mode spot check OK. Screenshots: /tmp/qa-notifications.png, /tmp/qa-notifications-mobile.png, /tmp/qa-notifications-dark.png.
- dev.log: 21× GET /api/notifications all 200. Zero data mutations by me (the open QA shift belongs to concurrent agent 18-c).

## Constraints / limitations
- Badge counts the API's capped arrays (≤8 each) — a >8-alert store under-reports vs true totals.
- Empty state untested E2E (seed always has ≥1 low-stock item); code-reviewed only.
- Shift elapsed label refreshes only on poll/data change (≤60s staleness).
- Pre-existing (outside my scope, reported to main agent): dashboard recent-sales TABLE overflows at 390px (scrollWidth 452 with popover closed).
