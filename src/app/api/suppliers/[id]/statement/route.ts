// GET /api/suppliers/[id]/statement — supplier statement:
// supplied-product portfolio, PO history and purchase stats (additive read-only).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const supplier = await db.supplier.findUnique({ where: { id } })
    if (!supplier) return bad('Supplier not found', 404)

    const [products, orders] = await Promise.all([
      db.product.findMany({
        where: { supplierId: id },
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          stock: true,
          costPrice: true,
          price: true,
          reorderLevel: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      }),
      db.purchaseOrder.findMany({
        where: { supplierId: id },
        include: { items: { select: { qty: true, unitCost: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ])

    // Product portfolio
    const active = products.filter((p) => p.isActive)
    const portfolio = {
      count: active.length,
      archivedCount: products.length - active.length,
      units: active.reduce((s, p) => s + p.stock, 0),
      stockCostValue: active.reduce((s, p) => s + p.stock * p.costPrice, 0),
      stockRetailValue: active.reduce((s, p) => s + p.stock * p.price, 0),
      lowStock: active.filter((p) => p.stock <= p.reorderLevel).length,
      topProducts: active
        .map((p) => ({
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          stock: p.stock,
          costPrice: p.costPrice,
          price: p.price,
          stockCostValue: p.stock * p.costPrice,
        }))
        .sort((a, b) => b.stockCostValue - a.stockCostValue)
        .slice(0, 12),
    }

    // PO stats
    const poValue = (po: (typeof orders)[number]) => po.items.reduce((s, i) => s + i.qty * i.unitCost, 0)
    const poStats = {
      total: orders.length,
      draft: orders.filter((o) => o.status === 'DRAFT').length,
      ordered: orders.filter((o) => o.status === 'ORDERED').length,
      received: orders.filter((o) => o.status === 'RECEIVED').length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
      draftValue: orders.filter((o) => o.status === 'DRAFT').reduce((s, o) => s + poValue(o), 0),
      openValue: orders
        .filter((o) => o.status === 'DRAFT' || o.status === 'ORDERED')
        .reduce((s, o) => s + poValue(o), 0),
      receivedValue: orders.filter((o) => o.status === 'RECEIVED').reduce((s, o) => s + poValue(o), 0),
      lastOrderAt: orders[0]?.createdAt.toISOString() ?? null,
      lastReceivedAt:
        orders.find((o) => o.status === 'RECEIVED' && o.receivedAt)?.receivedAt?.toISOString() ?? null,
    }

    const statement = {
      supplier: { ...supplier, _count: { products: portfolio.count } },
      generatedAt: new Date().toISOString(),
      portfolio: {
        ...portfolio,
        stockCostValue: Math.round(portfolio.stockCostValue * 100) / 100,
        stockRetailValue: Math.round(portfolio.stockRetailValue * 100) / 100,
      },
      poStats,
      orders: orders.map((o) => ({
        id: o.id,
        poNo: o.poNo,
        status: o.status,
        itemCount: o.items.length,
        totalQty: o.items.reduce((s, i) => s + i.qty, 0),
        totalCost: Math.round(poValue(o) * 100) / 100,
        note: o.note,
        createdAt: o.createdAt.toISOString(),
        receivedAt: o.receivedAt?.toISOString() ?? null,
      })),
    }

    return NextResponse.json(statement)
  } catch (e) {
    console.error('GET /api/suppliers/[id]/statement', e)
    return bad('Failed to build supplier statement', 500)
  }
}
