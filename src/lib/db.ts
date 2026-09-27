import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { runSeed } from './seed'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaInstance(): PrismaClient {
  const url = process.env.DATABASE_URL ?? ''
  const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN

  if (url.startsWith('libsql://') || url.startsWith('https://')) {
    console.log('⚡ Connecting to Turso (libSQL) remote database...')
    const adapter = new PrismaLibSql({
      url,
      authToken: authToken || undefined,
    })
    return new PrismaClient({ adapter })
  }

  return new PrismaClient()
}

const prismaInstance = globalForPrisma.prisma || createPrismaInstance()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaInstance

let isInitialized = false
let initPromise: Promise<void> | null = null

export async function ensureDbInitialized() {
  if (isInitialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      await prismaInstance.settings.count()
      isInitialized = true
    } catch {
      console.log('⚡ Table schema missing — auto-creating database tables & default settings...')
      const tables = [
        `CREATE TABLE IF NOT EXISTS "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE, "description" TEXT, "color" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS "Supplier" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "address" TEXT, "notes" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS "Product" ("id" TEXT NOT NULL PRIMARY KEY, "sku" TEXT NOT NULL UNIQUE, "barcode" TEXT UNIQUE, "name" TEXT NOT NULL, "description" TEXT, "imageUrl" TEXT, "unit" TEXT NOT NULL DEFAULT 'pcs', "categoryId" TEXT, "supplierId" TEXT, "costPrice" REAL NOT NULL DEFAULT 0, "price" REAL NOT NULL DEFAULT 0, "taxRate" REAL NOT NULL DEFAULT 0, "stock" REAL NOT NULL DEFAULT 0, "reorderLevel" REAL NOT NULL DEFAULT 5, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL, FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL);`,
        `CREATE TABLE IF NOT EXISTS "StockMovement" ("id" TEXT NOT NULL PRIMARY KEY, "productId" TEXT NOT NULL, "type" TEXT NOT NULL, "qty" REAL NOT NULL, "before" REAL NOT NULL, "after" REAL NOT NULL, "reference" TEXT, "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE);`,
        `CREATE TABLE IF NOT EXISTS "Customer" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "address" TEXT, "notes" TEXT, "creditLimit" REAL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS "Sale" ("id" TEXT NOT NULL PRIMARY KEY, "invoiceNo" TEXT NOT NULL UNIQUE, "customerId" TEXT, "subtotal" REAL NOT NULL DEFAULT 0, "discount" REAL NOT NULL DEFAULT 0, "tax" REAL NOT NULL DEFAULT 0, "total" REAL NOT NULL DEFAULT 0, "paid" REAL NOT NULL DEFAULT 0, "change" REAL NOT NULL DEFAULT 0, "costTotal" REAL NOT NULL DEFAULT 0, "profit" REAL NOT NULL DEFAULT 0, "paymentMethod" TEXT NOT NULL DEFAULT 'CASH', "status" TEXT NOT NULL DEFAULT 'COMPLETED', "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL);`,
        `CREATE TABLE IF NOT EXISTS "SaleItem" ("id" TEXT NOT NULL PRIMARY KEY, "saleId" TEXT NOT NULL, "productId" TEXT, "name" TEXT NOT NULL, "sku" TEXT NOT NULL, "qty" REAL NOT NULL, "unitPrice" REAL NOT NULL, "discount" REAL NOT NULL DEFAULT 0, "taxRate" REAL NOT NULL DEFAULT 0, "tax" REAL NOT NULL DEFAULT 0, "total" REAL NOT NULL, "costPrice" REAL NOT NULL DEFAULT 0, "imageUrl" TEXT, FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE, FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL);`,
        `CREATE TABLE IF NOT EXISTS "PurchaseOrder" ("id" TEXT NOT NULL PRIMARY KEY, "poNo" TEXT NOT NULL UNIQUE, "supplierId" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT', "note" TEXT, "receivedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL);`,
        `CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" ("id" TEXT NOT NULL PRIMARY KEY, "poId" TEXT NOT NULL, "productId" TEXT NOT NULL, "name" TEXT NOT NULL, "sku" TEXT NOT NULL, "qty" REAL NOT NULL, "receivedQty" REAL NOT NULL DEFAULT 0, "unitCost" REAL NOT NULL DEFAULT 0, FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE, FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE);`,
        `CREATE TABLE IF NOT EXISTS "ExpenseCategory" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE, "color" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE TABLE IF NOT EXISTS "ExpenseTemplate" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "categoryId" TEXT, "amount" REAL NOT NULL, "paymentMethod" TEXT NOT NULL DEFAULT 'CASH', "frequency" TEXT NOT NULL DEFAULT 'MONTHLY', "note" TEXT, "lastPostedAt" DATETIME, "active" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL);`,
        `CREATE TABLE IF NOT EXISTS "Expense" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "categoryId" TEXT, "amount" REAL NOT NULL, "paymentMethod" TEXT NOT NULL DEFAULT 'CASH', "spentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "reference" TEXT, "note" TEXT, "attachment" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL);`,
        `CREATE TABLE IF NOT EXISTS "Settings" ("id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main', "storeName" TEXT NOT NULL DEFAULT 'Circuit Store', "address" TEXT NOT NULL DEFAULT '', "phone" TEXT NOT NULL DEFAULT '', "currency" TEXT NOT NULL DEFAULT '৳', "currencyCode" TEXT NOT NULL DEFAULT 'BDT', "taxRate" REAL NOT NULL DEFAULT 0, "receiptFooter" TEXT NOT NULL DEFAULT 'Thank you for shopping with us!', "lowStockDays" INTEGER NOT NULL DEFAULT 7);`,
        `CREATE TABLE IF NOT EXISTS "Shift" ("id" TEXT NOT NULL PRIMARY KEY, "openedAt" DATETIME NOT NULL, "closedAt" DATETIME, "openingFloat" REAL NOT NULL DEFAULT 0, "countedCash" REAL, "totalsJson" TEXT, "note" TEXT, "openedBy" TEXT);`,
      ]

      for (const tableSql of tables) {
        await prismaInstance.$executeRawUnsafe(tableSql)
      }

      await prismaInstance.settings.upsert({
        where: { id: 'main' },
        create: {
          id: 'main',
          storeName: 'Circuit Electronics & More',
          address: 'Shop 12, Bashundhara City Complex, Panthapath, Dhaka 1215',
          phone: '+880 1711-000000',
          currency: '৳',
          currencyCode: 'BDT',
          taxRate: 0,
          receiptFooter: 'Thank you for shopping at Circuit!',
        },
        update: {},
      })

      isInitialized = true
    }
  })()

  return initPromise
}

export const db: PrismaClient = new Proxy(prismaInstance, {
  get(target, prop, receiver) {
    const val = Reflect.get(target, prop, receiver)
    if (typeof val === 'object' && val !== null) {
      return new Proxy(val, {
        get(modelTarget, modelProp, modelReceiver) {
          const fn = Reflect.get(modelTarget, modelProp, modelReceiver)
          if (typeof fn === 'function') {
            return async (...args: unknown[]) => {
              await ensureDbInitialized()
              return fn.apply(modelTarget, args)
            }
          }
          return fn
        },
      })
    }
    if (typeof val === 'function') {
      return async (...args: unknown[]) => {
        await ensureDbInitialized()
        return val.apply(target, args)
      }
    }
    return val
  },
})
