// POST /api/sales/[id]/settle — record a payment against an outstanding (credit) sale.
// Body: { amount: number } → paid = min(total, paid + amount); stock untouched.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const postSchema = z.object({
  amount: z.number().positive('Settlement amount must be > 0'),
  note: z.string().max(500).optional().nullable(),
})

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const body = postSchema.parse(await req.json())

    const updated = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true, customer: true } })
      if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 })
      if (sale.status === 'REFUNDED') throw new Error('Refunded sales cannot be settled')

      const outstanding = round2(sale.total - sale.paid)
      if (outstanding <= 0.001) throw new Error(`Invoice ${sale.invoiceNo} has no outstanding balance`)

      const amount = round2(Math.min(body.amount, outstanding))
      const paid = round2(sale.paid + amount)

      const result = await tx.sale.update({
        where: { id },
        data: {
          paid,
          change: 0,
          note: body.note ? `${sale.note ? sale.note + ' | ' : ''}Payment +${round2(amount)}: ${body.note}` : sale.note,
        },
        include: { items: true, customer: true },
      })
      return { sale: result, settled: amount, stillDue: round2(Math.max(0, result.total - result.paid)) }
    })

    return NextResponse.json({
      ...updated.sale,
      due: updated.stillDue,
      settledNow: updated.settled,
    })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (e instanceof Error) {
      const status = (e as Error & { status?: number }).status
      if (status === 404) return bad('Sale not found', 404)
      if (e.message.includes('cannot be settled') || e.message.includes('no outstanding')) return bad(e.message)
    }
    console.error('POST /api/sales/[id]/settle error:', e)
    return bad('Failed to settle sale', 500)
  }
}
