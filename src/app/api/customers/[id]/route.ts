// GET /api/customers/[id] — detail + last 20 sales
// PUT /api/customers/[id] — update
// DELETE /api/customers/[id] — delete (sales keep, customerId set null)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, round2 } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { sales: true } },
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, invoiceNo: true, total: true, paid: true, createdAt: true, status: true },
        },
      },
    })
    if (!customer) return bad('Customer not found', 404)

    const spentAgg = await db.sale.aggregate({
      _sum: { total: true },
      where: { customerId: id, status: 'COMPLETED' },
    })

    const totalDue = round2(
      customer.sales
        .filter((s) => s.status === 'COMPLETED' && s.total - s.paid > 0.001)
        .reduce((sum, s) => sum + (s.total - s.paid), 0)
    )

    return NextResponse.json({
      ...customer,
      sales: customer.sales.map((s) => ({ ...s, due: Math.max(0, round2(s.total - s.paid)) })),
      totalSpent: round2(spentAgg._sum.total ?? 0),
      totalDue,
      lastPurchaseAt: customer.sales[0]?.createdAt?.toISOString() ?? null,
    })
  } catch (e) {
    console.error('GET /api/customers/[id] error:', e)
    return bad('Failed to load customer', 500)
  }
}

const putSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  creditLimit: z.coerce.number().min(0, 'Credit limit must be >= 0').max(99_999_999).nullable().optional(),
})

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const data = putSchema.parse(await req.json())
    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) return bad('Customer not found', 404)

    const updated = await db.customer.update({
      where: { id },
      data: { ...data, creditLimit: data.creditLimit === undefined ? undefined : data.creditLimit },
    })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('PUT /api/customers/[id] error:', e)
    return bad('Failed to update customer', 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) return bad('Customer not found', 404)

    // Sale.customerId is onDelete: SetNull — invoices remain, link removed
    await db.customer.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/customers/[id] error:', e)
    return bad('Failed to delete customer', 500)
  }
}
