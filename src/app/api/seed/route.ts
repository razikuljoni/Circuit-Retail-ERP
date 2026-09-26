// POST /api/seed — reseed demo data (settings danger zone)
import { NextResponse } from 'next/server'
import { runSeed } from '@/lib/seed'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const counts = await runSeed()
    return NextResponse.json({ ok: true, counts })
  } catch (e) {
    console.error('Seed failed:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Seed failed' },
      { status: 500 }
    )
  }
}
