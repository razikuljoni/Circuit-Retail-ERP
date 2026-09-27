// POST /api/customers/[id]/settle-all — pay off ALL outstanding credit sales of a
// customer in one transaction. Returns { settledCount, settledTotal, customer }.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const result = await db.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } })
      if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 })

      const sales = await tx.sale.findMany({
        where: { customerId: id, status: 'COMPLETED' },
        select: { id: true, total: true, paid: true, invoiceNo: true },
      })

      const outstanding = sales.filter((s) => s.total - s.paid > 0.001)
      if (outstanding.length === 0) throw new Error(`${customer.name} has no outstanding credit sales`)

      let settledTotal = 0
      for (const s of outstanding) {
        const due = round2(s.total - s.paid)
        await tx.sale.update({
          where: { id: s.id },
          data: { paid: s.total, change: 0 },
        })
        settledTotal += due
      }

      return { settledCount: outstanding.length, settledTotal: round2(settledTotal), customer }
    })

    return NextResponse.json({
      ok: true,
      settledCount: result.settledCount,
      settledTotal: result.settledTotal,
      customer: { ...result.customer, totalDue: 0 },
    })
  } catch (e) {
    if (e instanceof Error) {
      const status = (e as Error & { status?: number }).status
      if (status === 404) return bad('Customer not found', 404)
      if (e.message.includes('no outstanding')) return bad(e.message)
    }
    console.error('POST /api/customers/[id]/settle-all error:', e)
    return bad('Failed to settle customer dues', 500)
  }
}
