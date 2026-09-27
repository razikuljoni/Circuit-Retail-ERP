/**
 * Seed logic — shared by scripts/seed.ts (CLI) and POST /api/seed (settings danger zone).
 * Populates: settings, categories, suppliers, products, customers,
 * expense categories, expenses, 30 days of sales + stock movements.
 */
import { db } from '@/lib/db'

// Deterministic-ish PRNG so demo data is stable
let seed = 42
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]
}
function rint(min: number, max: number) {
  return Math.floor(min + rnd() * (max - min + 1))
}

const dhakaOffset = 6 * 3600 * 1000

function dhakaDayStart(daysAgo: number): Date {
  const now = Date.now()
  const dhakaMs = now + dhakaOffset
  const dayStart = Math.floor(dhakaMs / 86400000) * 86400000
  return new Date(dayStart - dhakaOffset - daysAgo * 86400000)
}

export async function runSeed() {
  console.log('🌱 Clearing existing data...')
  await db.stockMovement.deleteMany()
  await db.saleItem.deleteMany()
  await db.sale.deleteMany()
  await db.expense.deleteMany()
  await db.expenseCategory.deleteMany()
  await db.product.deleteMany()
  await db.category.deleteMany()
  await db.supplier.deleteMany()
  await db.customer.deleteMany()
  await db.settings.deleteMany()

  console.log('⚙️ Settings...')
  await db.settings.create({
    data: {
      id: 'main',
      storeName: 'Circuit Electronics & More',
      address: 'Shop 12, Bashundhara City Complex, Panthapath, Dhaka 1215',
      phone: '+880 1711-000000',
      currency: '৳',
      currencyCode: 'BDT',
      taxRate: 0,
      receiptFooter: 'Thank you for shopping at Circuit! Exchange within 7 days with receipt.',
    },
  })

  console.log('📦 Categories & suppliers...')
  const catNames: [string, string][] = [
    ['Electronics', '#8b5cf6'],
    ['Accessories', '#ec4899'],
    ['Home Appliances', '#f59e0b'],
    ['Stationery', '#10b981'],
    ['Snacks & Drinks', '#ef4444'],
    ['Personal Care', '#14b8a6'],
    ['Household', '#f97316'],
  ]
  const cats: Record<string, string> = {}
  for (const [name, color] of catNames) {
    const c = await db.category.create({ data: { name, color } })
    cats[name] = c.id
  }

  const supplierNames = [
    'Walton Plaza Distributor',
    'Anwar Trade International',
    'Global Import House Ltd.',
    'Dhaka Wholesale Mart',
    'Fresh Foods Supply Co.',
  ]
  const suppliers: string[] = []
  for (let i = 0; i < supplierNames.length; i++) {
    const s = await db.supplier.create({
      data: {
        name: supplierNames[i],
        phone: `+880 17${rint(10, 99)}-${rint(100000, 999999)}`,
        email: `sales${i + 1}@supplier.com.bd`,
        address: pick(['Gulistan', 'Nawabpur Road', 'Chawkbazar', 'Mitford', 'Segunbagicha']) + ', Dhaka',
      },
    })
    suppliers.push(s.id)
  }

  console.log('🛒 Products...')
  type P = {
    sku: string; name: string; cat: string; cost: number; price: number;
    stock: number; reorder: number; taxRate?: number; unit?: string; barcode?: string
  }
  const products: P[] = [
    // Electronics
    { sku: 'ELC-001', name: 'Walton LED TV 32"', cat: 'Electronics', cost: 15500, price: 18990, stock: 6, reorder: 3 },
    { sku: 'ELC-002', name: 'Walton LED TV 43"', cat: 'Electronics', cost: 32000, price: 38500, stock: 4, reorder: 2 },
    { sku: 'ELC-003', name: 'Bluetooth Speaker X15', cat: 'Electronics', cost: 850, price: 1350, stock: 24, reorder: 8 },
    { sku: 'ELC-004', name: 'Wireless Earbuds Pro', cat: 'Electronics', cost: 1150, price: 1890, stock: 18, reorder: 6 },
    { sku: 'ELC-005', name: 'Smart Watch Fit 2', cat: 'Electronics', cost: 1900, price: 2990, stock: 12, reorder: 5 },
    { sku: 'ELC-006', name: 'Power Bank 20000mAh', cat: 'Electronics', cost: 1050, price: 1650, stock: 15, reorder: 6 },
    { sku: 'ELC-007', name: 'Android TV Box S9', cat: 'Electronics', cost: 3200, price: 4600, stock: 7, reorder: 3 },
    { sku: 'ELC-008', name: 'WiFi Router AC1200', cat: 'Electronics', cost: 1750, price: 2550, stock: 9, reorder: 4 },
    { sku: 'ELC-009', name: 'USB-C Fast Charger 33W', cat: 'Electronics', cost: 480, price: 790, stock: 30, reorder: 10 },
    { sku: 'ELC-010', name: 'LED Desk Lamp Rechargeable', cat: 'Electronics', cost: 520, price: 890, stock: 3, reorder: 5 },
    // Accessories
    { sku: 'ACC-001', name: 'Phone Case Clear (iPhone 15)', cat: 'Accessories', cost: 90, price: 250, stock: 45, reorder: 15 },
    { sku: 'ACC-002', name: 'Tempered Glass 9H', cat: 'Accessories', cost: 45, price: 150, stock: 60, reorder: 20 },
    { sku: 'ACC-003', name: 'USB-C Cable 1m Braided', cat: 'Accessories', cost: 110, price: 280, stock: 38, reorder: 12 },
    { sku: 'ACC-004', name: 'Laptop Backpack 15.6"', cat: 'Accessories', cost: 950, price: 1650, stock: 11, reorder: 4 },
    { sku: 'ACC-005', name: 'Wireless Mouse Silent', cat: 'Accessories', cost: 380, price: 650, stock: 22, reorder: 8 },
    { sku: 'ACC-006', name: 'Mechanical Keyboard RGB', cat: 'Accessories', cost: 1850, price: 2790, stock: 5, reorder: 4 },
    { sku: 'ACC-007', name: 'Car Charger Dual USB', cat: 'Accessories', cost: 150, price: 350, stock: 26, reorder: 10 },
    { sku: 'ACC-008', name: 'Selfie Stick Tripod', cat: 'Accessories', cost: 190, price: 420, stock: 2, reorder: 6 },
    // Home Appliances
    { sku: 'HOM-001', name: 'Electric Kettle 1.8L', cat: 'Home Appliances', cost: 980, price: 1490, stock: 14, reorder: 5 },
    { sku: 'HOM-002', name: 'Rice Cooker 2.8L', cat: 'Home Appliances', cost: 1850, price: 2650, stock: 8, reorder: 4 },
    { sku: 'HOM-003', name: 'Ceiling Fan 56"', cat: 'Home Appliances', cost: 3900, price: 5250, stock: 6, reorder: 3 },
    { sku: 'HOM-004', name: 'Blender & Juicer 500W', cat: 'Home Appliances', cost: 2250, price: 3290, stock: 5, reorder: 3 },
    { sku: 'HOM-005', name: 'Iron Dry 1200W', cat: 'Home Appliances', cost: 920, price: 1390, stock: 9, reorder: 4 },
    { sku: 'HOM-006', name: 'Room Heater Quartz', cat: 'Home Appliances', cost: 1450, price: 2150, stock: 0, reorder: 3 },
    // Stationery
    { sku: 'STA-001', name: 'A4 Paper Rim (500s)', cat: 'Stationery', cost: 440, price: 560, stock: 25, reorder: 10 },
    { sku: 'STA-002', name: 'Ballpoint Pen Pack (10)', cat: 'Stationery', cost: 65, price: 120, stock: 48, reorder: 15 },
    { sku: 'STA-003', name: 'Notebook 200 Pages', cat: 'Stationery', cost: 85, price: 150, stock: 55, reorder: 20 },
    { sku: 'STA-004', name: 'Gel Pen Premium (3pk)', cat: 'Stationery', cost: 70, price: 140, stock: 1, reorder: 10 },
    // Snacks & Drinks
    { sku: 'SNK-001', name: 'Instant Noodles (5pk)', cat: 'Snacks & Drinks', cost: 58, price: 85, stock: 80, reorder: 25 },
    { sku: 'SNK-002', name: 'Potato Chips 52g', cat: 'Snacks & Drinks', cost: 12, price: 20, stock: 120, reorder: 40 },
    { sku: 'SNK-003', name: 'Mineral Water 1L', cat: 'Snacks & Drinks', cost: 14, price: 25, stock: 90, reorder: 30, unit: 'pcs' },
    { sku: 'SNK-004', name: 'Soft Drink Can 250ml', cat: 'Snacks & Drinks', cost: 22, price: 35, stock: 100, reorder: 36 },
    { sku: 'SNK-005', name: 'Chocolate Bar 40g', cat: 'Snacks & Drinks', cost: 55, price: 90, stock: 65, reorder: 20 },
    { sku: 'SNK-006', name: 'Tea Bag Box (50s)', cat: 'Snacks & Drinks', cost: 130, price: 195, stock: 28, reorder: 10 },
    // Personal Care
    { sku: 'PER-001', name: 'Shampoo 350ml', cat: 'Personal Care', cost: 210, price: 320, stock: 35, reorder: 12 },
    { sku: 'PER-002', name: 'Toothpaste 140g', cat: 'Personal Care', cost: 95, price: 145, stock: 42, reorder: 15 },
    { sku: 'PER-003', name: 'Face Wash 100ml', cat: 'Personal Care', cost: 165, price: 260, stock: 20, reorder: 8 },
    { sku: 'PER-004', name: 'Hand Sanitizer 250ml', cat: 'Personal Care', cost: 75, price: 130, stock: 4, reorder: 10 },
    // Household
    { sku: 'HOU-001', name: 'Dish Wash 500ml', cat: 'Household', cost: 105, price: 160, stock: 30, reorder: 12 },
    { sku: 'HOU-002', name: 'Floor Cleaner 1L', cat: 'Household', cost: 150, price: 235, stock: 22, reorder: 8 },
    { sku: 'HOU-003', name: 'Mosquito Spray 400ml', cat: 'Household', cost: 125, price: 185, stock: 26, reorder: 10 },
    { sku: 'HOU-004', name: 'LED Bulb 12W (2pk)', cat: 'Household', cost: 180, price: 290, stock: 34, reorder: 12 },
  ]

  const productIds: { id: string; sku: string; name: string; cost: number; price: number; stock: number }[] = []
  let barcodeSeq = 1000
  for (const p of products) {
    barcodeSeq += 1
    const created = await db.product.create({
      data: {
        sku: p.sku,
        barcode: `880${barcodeSeq}`,
        name: p.name,
        unit: p.unit ?? 'pcs',
        categoryId: cats[p.cat],
        supplierId: pick(suppliers),
        costPrice: p.cost,
        price: p.price,
        taxRate: p.taxRate ?? 0,
        stock: 0, // set via PURCHASE movement below
        reorderLevel: p.reorder,
      },
    })
    // Healthy opening stock: enough to survive 30 days of demo sales without mass stock-outs
    const purchaseQty = Math.max(p.stock * 3, p.reorder * 8)
    await db.stockMovement.create({
      data: {
        productId: created.id,
        type: 'PURCHASE',
        qty: purchaseQty,
        before: 0,
        after: purchaseQty,
        reference: 'GRN-OPEN-001',
        note: 'Opening stock',
      },
    })
    await db.product.update({ where: { id: created.id }, data: { stock: purchaseQty } })
    productIds.push({ id: created.id, sku: created.sku, name: created.name, cost: p.cost, price: p.price, stock: purchaseQty })
  }

  console.log('👥 Customers...')
  const customerNames = [
    'Walk-in Customer', 'Rahim Uddin', 'Nusrat Jahan', 'Tanvir Ahmed',
    'Sadia Islam', 'Mahmud Hasan', 'Farhana Akter', 'Imran Chowdhury',
  ]
  const customers: string[] = []
  for (let i = 0; i < customerNames.length; i++) {
    const c = await db.customer.create({
      data: {
        name: customerNames[i],
        phone: i === 0 ? null : `+880 18${rint(10, 99)}-${rint(100000, 999999)}`,
        email: i > 3 ? `customer${i}@mail.com` : null,
        notes: i === 0 ? 'Default walk-in' : null,
      },
    })
    customers.push(c.id)
  }

  console.log('💸 Expense categories & expenses...')
  const expCats: [string, string][] = [
    ['Rent', '#8b5cf6'],
    ['Utilities', '#0ea5e9'],
    ['Salaries', '#10b981'],
    ['Transport', '#f59e0b'],
    ['Marketing', '#ec4899'],
    ['Maintenance', '#ef4444'],
    ['Supplies', '#14b8a6'],
    ['Miscellaneous', '#64748b'],
  ]
  const expCatIds: Record<string, string> = {}
  for (const [name, color] of expCats) {
    const c = await db.expenseCategory.create({ data: { name, color } })
    expCatIds[name] = c.id
  }

  const expensesToCreate: { title: string; cat: string; amount: number; daysAgo: number; method: string; note?: string }[] = [
    { title: 'Shop rent — previous month', cat: 'Rent', amount: 35000, daysAgo: 28, method: 'BANK', note: 'Landlord: Mr. Karim' },
    { title: 'Staff salaries (3 staff)', cat: 'Salaries', amount: 48000, daysAgo: 27, method: 'BANK' },
    { title: 'Electricity bill', cat: 'Utilities', amount: 6200, daysAgo: 25, method: 'MOBILE' },
    { title: 'Internet bill (Broadband)', cat: 'Utilities', amount: 1500, daysAgo: 24, method: 'MOBILE' },
    { title: 'Van fare — goods pickup', cat: 'Transport', amount: 800, daysAgo: 22, method: 'CASH' },
    { title: 'Facebook boosted post', cat: 'Marketing', amount: 500, daysAgo: 20, method: 'MOBILE' },
    { title: 'AC servicing', cat: 'Maintenance', amount: 1800, daysAgo: 18, method: 'CASH' },
    { title: 'Packing bags & tape', cat: 'Supplies', amount: 650, daysAgo: 16, method: 'CASH' },
    { title: 'Water bill', cat: 'Utilities', amount: 400, daysAgo: 14, method: 'CASH' },
    { title: 'Shop signage repair', cat: 'Maintenance', amount: 1200, daysAgo: 12, method: 'CASH' },
    { title: 'Generator fuel', cat: 'Utilities', amount: 900, daysAgo: 10, method: 'CASH' },
    { title: 'Leaflet printing', cat: 'Marketing', amount: 700, daysAgo: 8, method: 'CASH' },
    { title: 'CCTV subscription', cat: 'Maintenance', amount: 1000, daysAgo: 6, method: 'CARD' },
    { title: 'Delivery bike fuel', cat: 'Transport', amount: 500, daysAgo: 4, method: 'CASH' },
    { title: 'Tea & snacks for staff', cat: 'Miscellaneous', amount: 260, daysAgo: 3, method: 'CASH' },
    { title: 'Cleaning supplies', cat: 'Supplies', amount: 380, daysAgo: 2, method: 'CASH' },
    { title: 'Courier charge — return parcel', cat: 'Transport', amount: 150, daysAgo: 1, method: 'MOBILE' },
    { title: 'Reload merchant balance', cat: 'Miscellaneous', amount: 300, daysAgo: 0, method: 'MOBILE' },
  ]
  for (const e of expensesToCreate) {
    await db.expense.create({
      data: {
        title: e.title,
        categoryId: expCatIds[e.cat],
        amount: e.amount,
        paymentMethod: e.method,
        spentAt: new Date(dhakaDayStart(e.daysAgo).getTime() + rint(9, 19) * 3600 * 1000),
        note: e.note,
      },
    })
  }

  console.log('🧾 Generating 30 days of sales...')
  const invoiceCounter: Record<string, number> = {}
  const methods = ['CASH', 'CASH', 'CASH', 'CASH', 'CARD', 'MOBILE', 'MOBILE']

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const dayStart = dhakaDayStart(daysAgo)
    const dayKey = new Date(dayStart.getTime() + dhakaOffset).toISOString().slice(0, 10).replace(/-/g, '')
    const isFriday = new Date(dayStart.getTime() + dhakaOffset).getDay() === 5
    const txCount = daysAgo === 0 ? rint(4, 9) : rint(6, isFriday ? 18 : 13)

    for (let t = 0; t < txCount; t++) {
      const hour = pick([10, 11, 12, 13, 14, 15, 16, 17, 18, 18, 19, 19, 20, 21])
      const at = new Date(dayStart.getTime() + hour * 3600 * 1000 + rint(0, 55) * 60 * 1000)
      if (at.getTime() > Date.now()) continue

      const itemCount = rint(1, 4)
      const chosen: typeof productIds = []
      for (let i = 0; i < itemCount; i++) {
        const p = pick(productIds)
        if (!chosen.find((c) => c.id === p.id)) chosen.push(p)
      }

      const itemsData = chosen.map((p) => {
        const qty = p.price > 10000 ? 1 : rint(1, 3)
        const lineDiscount = rnd() < 0.15 ? rint(5, 30) : 0
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          qty,
          unitPrice: p.price,
          discount: lineDiscount,
          taxRate: 0,
          tax: 0,
          total: p.price * qty - lineDiscount,
          costPrice: p.cost,
        }
      })

      const subtotal = itemsData.reduce((s, i) => s + i.unitPrice * i.qty, 0)
      const lineDisc = itemsData.reduce((s, i) => s + i.discount, 0)
      const orderDiscount = rnd() < 0.1 ? rint(10, 50) : 0
      const total = subtotal - lineDisc - orderDiscount
      const costTotal = itemsData.reduce((s, i) => s + i.costPrice * i.qty, 0)
      const method = pick(methods)
      const paid = method === 'CASH' ? Math.ceil(total / 100) * 100 + (rnd() < 0.3 ? 100 : 0) : total

      invoiceCounter[dayKey] = (invoiceCounter[dayKey] ?? 0) + 1
      const invoiceNo = `INV-${dayKey}-${String(invoiceCounter[dayKey]).padStart(4, '0')}`

      await db.sale.create({
        data: {
          invoiceNo,
          customerId: rnd() < 0.35 ? pick(customers) : null,
          subtotal,
          discount: lineDisc + orderDiscount,
          tax: 0,
          total,
          paid,
          change: Math.max(0, paid - total),
          costTotal,
          profit: total - costTotal,
          paymentMethod: method,
          status: 'COMPLETED',
          createdAt: at,
          items: { create: itemsData },
        },
      })

      for (const it of itemsData) {
        const prod = await db.product.findUnique({ where: { id: it.productId! } })
        if (!prod) continue
        const after = Math.max(0, prod.stock - it.qty)
        await db.stockMovement.create({
          data: {
            productId: prod.id,
            type: 'SALE',
            qty: -it.qty,
            before: prod.stock,
            after,
            reference: invoiceNo,
          },
        })
        await db.product.update({ where: { id: prod.id }, data: { stock: after } })
      }
    }
  }

  // A couple of refunds on older sales
  const refundable = await db.sale.findMany({
    where: { createdAt: { gte: dhakaDayStart(10) } },
    orderBy: { createdAt: 'asc' },
    take: 2,
    include: { items: true },
  })
  for (const s of refundable) {
    await db.sale.update({ where: { id: s.id }, data: { status: 'REFUNDED', note: 'Customer return — unopened item' } })
    for (const it of s.items) {
      if (!it.productId) continue
      const prod = await db.product.findUnique({ where: { id: it.productId } })
      if (!prod) continue
      const after = prod.stock + it.qty
      await db.stockMovement.create({
        data: { productId: prod.id, type: 'REFUND', qty: it.qty, before: prod.stock, after, reference: s.invoiceNo, note: 'Refund' },
      })
      await db.product.update({ where: { id: prod.id }, data: { stock: after } })
    }
  }

  const counts = {
    products: await db.product.count(),
    sales: await db.sale.count(),
    saleItems: await db.saleItem.count(),
    expenses: await db.expense.count(),
    customers: await db.customer.count(),
    movements: await db.stockMovement.count(),
  }
  console.log('✅ Seed complete:', JSON.stringify(counts))
  return counts
}
