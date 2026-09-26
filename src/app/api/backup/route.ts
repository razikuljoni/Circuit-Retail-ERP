// GET /api/backup — full JSON export of all business data (settings danger zone / data portability)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [settings, categories, suppliers, products, customers, sales, expenses, expenseCategories, movements] =
      await Promise.all([
        db.settings.findMany(),
        db.category.findMany({ orderBy: { name: 'asc' } }),
        db.supplier.findMany({ orderBy: { name: 'asc' } }),
        db.product.findMany({ orderBy: { sku: 'asc' }, include: { category: { select: { name: true } }, supplier: { select: { name: true } } } }),
        db.customer.findMany({ orderBy: { name: 'asc' } }),
        db.sale.findMany({ orderBy: { createdAt: 'asc' }, include: { items: true, customer: { select: { name: true } } } }),
        db.expense.findMany({ orderBy: { spentAt: 'asc' }, include: { category: { select: { name: true } } } }),
        db.expenseCategory.findMany({ orderBy: { name: 'asc' } }),
        db.stockMovement.findMany({ orderBy: { createdAt: 'asc' } }),
      ])

    const payload = {
      app: 'Circuit Retail ERP',
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: {
        products: products.length,
        sales: sales.length,
        expenses: expenses.length,
        customers: customers.length,
        suppliers: suppliers.length,
        movements: movements.length,
      },
      settings,
      categories,
      suppliers,
      products,
      customers,
      sales,
      expenses,
      expenseCategories,
      stockMovements: movements,
    }

    return NextResponse.json(payload)
  } catch (e) {
    console.error('GET /api/backup error:', e)
    return NextResponse.json({ error: 'Failed to build backup' }, { status: 500 })
  }
}
