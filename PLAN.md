# Circuit Retail ERP — Master Plan (Enhanced & Production-Grade)

> Reconstructed & enhanced from "Retail ERP Plan from Circuit.md" (file did not arrive in upload, plan rebuilt from scope: Inventory + POS Invoicing + Expenses + Daily Sales Dashboard).

## 1. Vision
A single-tenant, keyboard-friendly retail operations suite for small/medium shops:
- **Sell fast** at the counter (POS with barcode/SKU search, held carts, receipts)
- **Know your numbers daily** (sales, profit, expenses, net) on a live dashboard
- **Never run out of stock** (reorder alerts, stock movement ledger, adjustments)
- **Track every expense** with categories and monthly summaries
- **Report like a pro** (X/Z-style daily summary, product & category performance, P&L)

## 2. Architecture
- **Next.js 16 App Router + TypeScript** (single visible route `/`, view-switched SPA shell)
- **API routes** under `/api/*` (no server actions), zod-validated
- **Prisma + SQLite** (`db/custom.db`), local memory friendly
- **shadcn/ui (New York)** + Tailwind CSS 4 + Lucide icons + recharts
- **Zustand** for POS cart & UI state; fetch-based data layer with typed client
- Dark/light theme via next-themes; sticky footer; fully responsive (mobile drawer nav)

## 3. Data Model (Prisma)
| Model | Purpose / Key fields |
|---|---|
| `Category` | product taxonomy: name, description |
| `Supplier` | name, phone, email, address, notes |
| `Product` | sku, barcode, name, unit, category, supplier, costPrice, price, taxRate, stock, reorderLevel, isActive |
| `StockMovement` | immutable ledger: type (PURCHASE/SALE/ADJUST/DAMAGE/RETURN), signed qty, before/after, ref, note |
| `Customer` | name, phone, email, address, notes |
| `Sale` | invoiceNo (INV-YYYYMMDD-####), items, subtotal/discount/tax/total, paid, change, paymentMethod (CASH/CARD/MOBILE/MIXED), status (COMPLETED/REFUNDED), note |
| `SaleItem` | snapshot of product name/sku/cost for historical accuracy |
| `ExpenseCategory` | name, color |
| `Expense` | title, category, amount, paymentMethod, spentAt, note, reference |
| `Settings` | storeName, address, phone, currency (default ৳ BDT), taxRate, receiptFooter, lowStockThreshold behavior |

Business rules:
- Sale creation is **transactional**: invoice sequence per-day, stock decrement + StockMovement rows atomically.
- Refund/void restores stock, keeps invoice trail (`status=REFUNDED`), never deletes.
- Profit = Σ(saleItem.price−cost) − discounts; Net = grossProfit − expenses (same period).
- Cost basis: moving average is overkill → use product.costPrice snapshot at sale time (editable).

## 4. Modules & Features
### 4.1 Dashboard (Daily Sales) — landing view
- KPI cards: Today Sales, Transactions, Avg Basket, Gross Profit, Expenses Today, Net Profit (with % vs yesterday)
- Charts: hourly sales (area), last 14 days sales vs expenses (bars+line), payment mix (donut), top 5 products (bar)
- Live lists: recent transactions, recent expenses, low-stock alert strip
- Auto-refresh every 60s + manual refresh

### 4.2 POS Terminal
- Grid + instant search (name/SKU/barcode, `Enter` adds first match), category filter chips
- Cart: qty steppers, line discount, order discount, tax per item, live totals, hold/park & resume, clear
- Checkout dialog: payment method tabs, quick-cash buttons, change calc, customer select, note
- On success: printable receipt (thermal-friendly 80mm) with store header, items, totals, footer
- Keyboard: F2 focus search, `+`/`-` qty, `Del` clear cart

### 4.3 Products & Inventory
- Product table: search, category/supplier filters, stock status chips, inline edit dialog, archive
- Import-ready: bulk add via quick-add rows; export CSV
- Stock center: receive stock (GRN), adjust, damage w/ reason → writes movements
- Movement ledger with filters; low-stock & out-of-stock tabs; stock valuation card (cost & retail)

### 4.4 Sales & Invoices
- Sales list: date-range + method + status filters, live totals of filtered set
- Invoice drawer: full detail, reprint receipt, refund (with confirm), note
- Daily summary (Z-report): sales by method, refunds, discounts, tax, net cash

### 4.5 Expenses
- Expense CRUD with categories, methods, date picker, reference no
- Category manager (color chips); month picker summary; list grouped by day; monthly total card

### 4.6 Customers & Suppliers
- CRUD + phone search; customer purchase history & lifetime value; supplier list linked to products

### 4.7 Reports
- Date-range P&L (revenue, discounts, refunds, COGS, gross, expenses by category, net)
- Product performance (qty, revenue, profit, margin), category performance, payment method split
- Export CSV for all tables

### 4.8 Settings
- Store profile, currency symbol, default tax rate, receipt footer
- Danger zone: reseed demo data

## 5. API Surface
```
GET/POST  /api/products            GET/PUT/DELETE /api/products/[id]
GET/POST  /api/categories          PUT/DELETE     /api/categories/[id]
GET/POST  /api/suppliers           PUT/DELETE     /api/suppliers/[id]
GET/POST  /api/customers           PUT/DELETE     /api/customers/[id]
GET/POST  /api/sales               GET/POST refund /api/sales/[id]
GET/POST  /api/expenses            PUT/DELETE     /api/expenses/[id]
GET/POST  /api/expense-categories  PUT/DELETE     /api/expense-categories/[id]
GET       /api/stock/movements     POST /api/stock/adjust
GET       /api/dashboard           GET /api/reports?type=pnl|products|daily
GET/PUT   /api/settings            POST /api/seed
```

## 6. UX Standards
- Sticky footer: `min-h-screen flex flex-col` root, footer `mt-auto`, safe-area padding
- Cards `p-4/p-6`, gaps `gap-4/gap-6`; long lists `max-h-96 overflow-y-auto` + styled scrollbar
- Toasts (sonner) for every mutation; loading skeletons; destructive actions confirm
- Currency ৳ (BDT) default, configurable; dates in `Asia/Dhaka`
- Accessible: semantic landmarks, aria labels, 44px touch targets, keyboard POS flows

## 7. Build Order (Tasks)
1. Foundation: plan, schema, seed, libs *(owner: Z)*
2. API layer (all routes) — *full-stack-developer*
3. App shell: sidebar/header/footer/theme/nav — *frontend-styling-expert*
4. Dashboard + Reports — *full-stack-developer*
5. POS + Sales/Receipts — *full-stack-developer*
6. Products/Inventory/Expenses/Customers/Suppliers/Settings — *full-stack-developer*
7. Integration, lint, seed run, agent-browser E2E QA + fixes *(owner: Z)*
8. Recurring webDevReview cron (15 min) *(owner: Z)*

## 8. Acceptance Checklist
- [ ] POS: search→add→discount→pay cash→receipt→stock deducted→dashboard updates
- [ ] Refund restores stock & shows in reports
- [ ] Expense added today reflects in Net Profit KPI
- [ ] Low-stock product flagged on dashboard & inventory
- [ ] Empty states everywhere; no white screens; lint passes; footer sticks
