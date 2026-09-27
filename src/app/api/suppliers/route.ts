// GET /api/suppliers — list with product counts
// POST /api/suppliers — create
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const suppliers = await db.supplier.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json(suppliers)
  } catch (e) {
    console.error('GET /api/suppliers error:', e)
    return bad('Failed to load suppliers', 500)
  }
}

const baseSchema = {
  name: z.string().trim().min(1, 'Name is required').max(160),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}

export async function POST(req: NextRequest) {
  try {
    const data = z.object(baseSchema).parse(await req.json())
    const supplier = await db.supplier.create({ data })
    return NextResponse.json(supplier, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    console.error('POST /api/suppliers error:', e)
    return bad('Failed to create supplier', 500)
  }
}
