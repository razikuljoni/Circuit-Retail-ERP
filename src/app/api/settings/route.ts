// GET /api/settings — store settings (creates default row if missing)
// PUT /api/settings — partial update
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  storeName: 'Circuit Store',
  address: '',
  phone: '',
  currency: '৳',
  currencyCode: 'BDT',
  taxRate: 0,
  receiptFooter: 'Thank you for shopping with us!',
}

export async function GET() {
  try {
    let settings = await db.settings.findUnique({ where: { id: 'main' } })
    if (!settings) {
      settings = await db.settings.create({ data: { id: 'main', ...DEFAULTS } })
    }
    return NextResponse.json(settings)
  } catch (e) {
    console.error('GET /api/settings error:', e)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

const putSchema = z.object({
  storeName: z.string().trim().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  currency: z.string().trim().min(1).optional(),
  currencyCode: z.string().trim().min(1).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  receiptFooter: z.string().optional(),
  lowStockDays: z.number().int().min(1).max(365).optional(),
})

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const data = putSchema.parse(body)

    const existing = await db.settings.findUnique({ where: { id: 'main' } })
    if (!existing) {
      await db.settings.create({ data: { id: 'main', ...DEFAULTS } })
    }

    const updated = await db.settings.update({
      where: { id: 'main' },
      data,
    })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('PUT /api/settings error:', e)
    return bad('Failed to update settings', 500)
  }
}
