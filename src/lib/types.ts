// ── Shared types (mirrors Prisma models, JSON-serialized) ──

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE' | 'BANK'
export type SaleStatus = 'COMPLETED' | 'REFUNDED'
export type MovementType = 'PURCHASE' | 'SALE' | 'ADJUST' | 'DAMAGE' | 'RETURN' | 'REFUND'

export interface Category {
  id: string
  name: string
  description?: string | null
  color?: string | null
  _count?: { products: number }
}

export interface Supplier {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  _count?: { products: number }
}

export interface Product {
  id: string
  sku: string
  barcode?: string | null
  name: string
  description?: string | null
  /** Optional product photo (http(s) URL or data:image URI) — falls back to initials tile */
  imageUrl?: string | null
  unit: string
  categoryId?: string | null
  category?: Category | null
  supplierId?: string | null
  supplier?: Supplier | null
  costPrice: number
  price: number
  taxRate: number
  stock: number
  reorderLevel: number
  isActive: boolean
  /** Sales velocity (units/day, last 7 days) — added by GET /api/products */
  avgDailyQty?: number
  /** Estimated days until stock runs out at current velocity (null = no sales) */
  daysCover?: number | null
  createdAt?: string
}

export interface StockMovement {
  id: string
  productId: string
  product?: { id: string; name: string; sku: string; unit: string }
  type: MovementType
  qty: number
  before: number
  after: number
  reference?: string | null
  note?: string | null
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  _count?: { sales: number }
  // aggregates from GET /api/customers (additive)
  totalSpent?: number
  lastPurchaseAt?: string | null
  /** Outstanding credit = Σ(total − paid) across COMPLETED sales (additive) */
  totalDue?: number
  /** Optional credit ceiling; null/undefined = no limit (additive) */
  creditLimit?: number | null
}

export interface SaleItem {
  id: string
  productId?: string | null
  name: string
  sku: string
  qty: number
  unitPrice: number
  discount: number
  taxRate: number
  tax: number
  total: number
  costPrice: number
}

export interface Sale {
  id: string
  invoiceNo: string
  customerId?: string | null
  customer?: Customer | null
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  change: number
  costTotal: number
  profit: number
  paymentMethod: PaymentMethod
  status: SaleStatus
  note?: string | null
  createdAt: string
  /** Outstanding credit (total − paid, when positive) — added by API responses */
  due?: number
}

export interface ExpenseCategory {
  id: string
  name: string
  color?: string | null
  _count?: { expenses: number }
  // current Dhaka-month expense total (additive, from GET /api/expense-categories)
  monthTotal?: number
}

export interface Expense {
  id: string
  title: string
  categoryId?: string | null
  category?: ExpenseCategory | null
  amount: number
  paymentMethod: PaymentMethod
  spentAt: string
  reference?: string | null
  note?: string | null
  /** Optional receipt photo (http(s) URL or data:image URI) — additive */
  attachment?: string | null
}

export interface StoreSettings {
  id: string
  storeName: string
  address: string
  phone: string
  currency: string
  currencyCode: string
  taxRate: number
  receiptFooter: string
}

// ── Cart (client-side) ──

export interface CartItem {
  key: string // productId (or productId+price for variants)
  productId: string
  name: string
  sku: string
  unit: string
  imageUrl?: string | null
  unitPrice: number
  costPrice: number
  taxRate: number
  qty: number
  discount: number // line discount amount for the whole line
  stock: number
}

export interface CashDrawer {
  cashSales: number
  cashExpenses: number
  expectedCash: number
}

export interface DashboardData {
  /** Dhaka day-key being viewed (additive, from API) — equals today's key on the live view */
  viewDate?: string
  /** True when the viewed day is the current Dhaka day (additive, from API) */
  isToday?: boolean
  today: {
    sales: number
    transactions: number
    avgBasket: number
    grossProfit: number
    expenses: number
    netProfit: number
    discounts: number
    refunds: number
  }
  yesterday: {
    sales: number
    transactions: number
    grossProfit: number
    expenses: number
  }
  hourly: { hour: string; label?: string; sales: number; transactions: number }[]
  daily: { date: string; label: string; sales: number; expenses: number; profit: number }[]
  paymentMix: { method: string; amount: number; count: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  recentSales: Sale[]
  recentExpenses: Expense[]
  lowStock: Product[]
  stockValue: { cost: number; retail: number; products: number; outOfStock: number; lowStock: number }
  cashDrawer: CashDrawer
}

export interface PnlReport {
  from: string
  to: string
  revenue: number
  refunds: number
  discounts: number
  tax: number
  cogs: number
  grossProfit: number
  expensesTotal: number
  expensesByCategory: { name: string; color?: string | null; amount: number }[]
  netProfit: number
  transactions: number
  avgBasket: number
}

export interface ProductPerformance {
  id: string
  name: string
  sku: string
  qty: number
  revenue: number
  profit: number
  margin: number
}

export interface DailySalesRow {
  date: string
  label: string
  transactions: number
  gross: number
  discounts: number
  refunds: number
  net: number
  cogs: number
  profit: number
  expenses: number
}

// ── Purchase orders ──

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderItem {
  id: string
  poId?: string
  productId: string
  product?: { id: string; name: string; sku: string; unit: string; stock?: number }
  name: string
  sku: string
  qty: number
  /** Units already received across all deliveries */
  receivedQty: number
  unitCost: number
}

export interface PurchaseOrder {
  id: string
  poNo: string
  supplierId?: string | null
  supplier?: Supplier | null
  status: PurchaseOrderStatus
  note?: string | null
  items: PurchaseOrderItem[]
  receivedAt?: string | null
  createdAt: string
  /** Units moved in the latest receive call (receive response only) */
  receivedNow?: number
}

// ── Z-Report (end-of-day) / X-Report (shift snapshot) ──

export interface ZReport {
  /** 'X' when the window starts mid-day (shift snapshot), 'Z' for the full day */
  kind: 'X' | 'Z'
  date: string
  /** Shift start time HH:MM for X-Reports, null for Z-Reports */
  fromTime: string | null
  label: string
  transactions: number
  itemsSold: number
  gross: number
  discounts: number
  refunds: number
  refundCount: number
  netSales: number
  tax: number
  costTotal: number
  grossProfit: number
  expensesTotal: number
  netProfit: number
  avgBasket: number
  byMethod: { method: string; amount: number; count: number }[]
  cashExpenses: number
  expectedCash: number
  hourly: { hour: string; label: string; sales: number; transactions: number }[]
  topItems: { name: string; sku: string; qty: number; revenue: number }[]
}

/** Receivables aging report (GET /api/customers/aging, additive) */
export interface AgingRow {
  customerId: string
  name: string
  phone: string | null
  creditLimit: number | null
  totalDue: number
  invoices: number
  oldestDays: number
  buckets: { c30: number; c60: number; c90: number; c90plus: number }
}

export interface AgingReport {
  generatedAt: string
  totalDue: number
  customersWithDues: number
  rows: AgingRow[]
}

// ── Expense templates (recurring expense blueprints) ──

export type ExpenseFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface ExpenseTemplate {
  id: string
  title: string
  categoryId?: string | null
  category?: ExpenseCategory | null
  amount: number
  paymentMethod: PaymentMethod
  frequency: ExpenseFrequency
  note?: string | null
  lastPostedAt?: string | null
  active: boolean
  createdAt?: string
}

/** POST /api/stock/stocktake response (additive) */
export interface StocktakeResult {
  adjusted: number
  unchanged: number
  missing: string[]
  varianceValue: number
  items: {
    productId: string
    name: string
    sku: string
    unit: string
    before: number
    after: number
    delta: number
  }[]
}

// ── Product detail (GET /api/products/[id]/detail, additive) ──

export interface ProductSaleEntry {
  saleId: string
  invoiceNo: string
  qty: number
  unitPrice: number
  discount: number
  tax: number
  total: number
  costPrice: number
  lineProfit: number
  paymentMethod: PaymentMethod
  status: SaleStatus
  customerName?: string | null
  createdAt: string
}

export interface ProductDetailStats {
  unitsSold30d: number
  revenue30d: number
  profit30d: number
  orders30d: number
  stockCostValue: number
  stockRetailValue: number
  marginPct: number | null
  avgDailyQty7d: number
  daysCover: number | null
}

export interface ProductDetail {
  product: Product
  stats: ProductDetailStats
  /** Last 12 sale lines containing this product (most recent first) */
  recentSales: ProductSaleEntry[]
  /** Last 15 stock movements for this product (most recent first) */
  movements: StockMovement[]
}

// ── Supplier statement (GET /api/suppliers/[id]/statement, additive) ──

export interface SupplierStatementOrder {
  id: string
  poNo: string
  status: PurchaseOrderStatus
  itemCount: number
  totalQty: number
  /** Units received so far across deliveries */
  receivedQty: number
  totalCost: number
  note?: string | null
  createdAt: string
  receivedAt?: string | null
}

export interface SupplierStatement {
  supplier: Supplier
  generatedAt: string
  portfolio: {
    count: number
    archivedCount: number
    units: number
    stockCostValue: number
    stockRetailValue: number
    lowStock: number
    topProducts: {
      name: string
      sku: string
      unit: string
      stock: number
      costPrice: number
      price: number
      stockCostValue: number
    }[]
  }
  poStats: {
    total: number
    draft: number
    ordered: number
    partial: number
    received: number
    cancelled: number
    draftValue: number
    openValue: number
    receivedValue: number
    lastOrderAt: string | null
    lastReceivedAt: string | null
  }
  orders: SupplierStatementOrder[]
}
