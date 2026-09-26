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

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderItem {
  id: string
  poId?: string
  productId: string
  product?: { id: string; name: string; sku: string; unit: string; stock?: number }
  name: string
  sku: string
  qty: number
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
}

// ── Z-Report (end-of-day) ──

export interface ZReport {
  date: string
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
