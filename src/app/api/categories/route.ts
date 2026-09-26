// GET /api/categories — list with product counts
// POST /api/categories — create
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bad, zodMsg, isUniqueError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json(categories)
  } catch (e) {
    console.error('GET /api/categories error:', e)
    return bad('Failed to load categories', 500)
  }
}

const postSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  color: z.string().trim().max(32).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const data = postSchema.parse(await req.json())
    const category = await db.category.create({ data })
    return NextResponse.json(category, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (isUniqueError(e)) return bad('Category name already exists')
    console.error('POST /api/categories error:', e)
    return bad('Failed to create category', 500)
  }
}
