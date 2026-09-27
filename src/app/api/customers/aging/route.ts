// GET /api/customers/aging — receivables aging report.
// Buckets outstanding (total − paid) of COMPLETED sales by invoice age (Dhaka days):
// current (≤30), 31–60, 61–90, 90+.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sales = await db.sale.findMany({
      where: { status: 'COMPLETED', customerId: { not: null } },
      select: {
        id: true,
        invoiceNo: true,
        total: true,
        paid: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true, creditLimit: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const DAY = 86_400_000
    const now = Date.now()

    type Bucket = { c30: number; c60: number; c90: number; c90plus: number }
    interface AgingRow {
      customerId: string
      name: string
      phone: string | null
      creditLimit: number | null
      totalDue: number
      invoices: number
      oldestDays: number
      buckets: Bucket
    }
    const map = new Map<string, AgingRow>()
    let grand = 0

    for (const s of sales) {
      const due = round2(s.total - s.paid)
      if (due <= 0.001 || !s.customer) continue
      const ageDays = Math.max(0, Math.floor((now - s.createdAt.getTime()) / DAY))
      let row = map.get(s.customer.id)
      if (!row) {
        row = {
          customerId: s.customer.id,
          name: s.customer.name,
          phone: s.customer.phone,
          creditLimit: s.customer.creditLimit ?? null,
          totalDue: 0,
          invoices: 0,
          oldestDays: ageDays,
          buckets: { c30: 0, c60: 0, c90: 0, c90plus: 0 },
        }
        map.set(s.customer.id, row)
      }
      row.totalDue = round2(row.totalDue + due)
      row.invoices += 1
      row.oldestDays = Math.max(row.oldestDays, ageDays)
      if (ageDays <= 30) row.buckets.c30 = round2(row.buckets.c30 + due)
      else if (ageDays <= 60) row.buckets.c60 = round2(row.buckets.c60 + due)
      else if (ageDays <= 90) row.buckets.c90 = round2(row.buckets.c90 + due)
      else row.buckets.c90plus = round2(row.buckets.c90plus + due)
      grand = round2(grand + due)
    }

    const rows = [...map.values()].sort((a, b) => b.totalDue - a.totalDue)
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalDue: grand,
      customersWithDues: rows.length,
      rows,
    })
  } catch (e) {
    console.error('GET /api/customers/aging error:', e)
    return bad('Failed to build aging report', 500)
  }
}
