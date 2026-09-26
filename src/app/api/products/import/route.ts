// POST /api/products/import — bulk create/update products from parsed CSV rows.
// Body: { rows: [...], mode: 'skip' | 'update', autoCreateCategories?: boolean }
// Each row: { name, sku?, barcode?, category?, supplier?, unit?, costPrice, price, stock?, reorderLevel?, taxRate? }
// Categories are matched by name (case-insensitive) and optionally auto-created.
// Suppliers are matched by name only (never auto-created). SKU collisions obey `mode`.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { bad, zodMsg, isUniqueError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const rowSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  sku: z.string().trim().max(60).optional().nullable(),
  barcode: z.string().trim().max(60).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  supplier: z.string().trim().max(120).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),
  costPrice: z.coerce.number().min(0, 'Cost must be >= 0').max(99_999_999),
  price: z.coerce.number().min(0, 'Price must be >= 0').max(99_999_999),
  stock: z.coerce.number().min(0).max(1_000_000).optional().default(0),
  reorderLevel: z.coerce.number().min(0).max(1_000_000).optional().default(5),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
})

const bodySchema = z.object({
  rows: z.array(z.unknown()).min(1, 'No rows to import').max(500),
  mode: z.enum(['skip', 'update']).default('skip'),
  autoCreateCategories: z.boolean().default(true),
})

function randomSku(): string {
  return `IMP-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`
}

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json())

    // Validate all rows first — collect per-row errors
    type ParsedRow = z.infer<typeof rowSchema> & { index: number }
    const parsed: ParsedRow[] = []
    const rowErrors: { row: number; message: string }[] = []
    const seenSkus = new Map<string, number>()
    const seenBarcodes = new Map<string, number>()

    for (let i = 0; i < body.rows.length; i++) {
      const res = rowSchema.safeParse(body.rows[i])
      if (!res.success) {
        rowErrors.push({ row: i + 1, message: zodMsg(res.error) })
        continue
      }
      const r = res.data
      const sku = (r.sku || '').toUpperCase()
      const barcode = (r.barcode || '').toUpperCase()
      if (sku) {
        if (seenSkus.has(sku)) {
          rowErrors.push({ row: i + 1, message: `Duplicate SKU "${sku}" (also row ${seenSkus.get(sku)})` })
          continue
        }
        seenSkus.set(sku, i + 1)
      }
      if (barcode) {
        if (seenBarcodes.has(barcode)) {
          rowErrors.push({ row: i + 1, message: `Duplicate barcode "${barcode}" (also row ${seenBarcodes.get(barcode)})` })
          continue
        }
        seenBarcodes.set(barcode, i + 1)
      }
      if (r.price > 0 && r.costPrice > r.price) {
        rowErrors.push({ row: i + 1, message: `Cost (${r.costPrice}) is above price (${r.price})` })
        continue
      }
      parsed.push({ ...r, sku, barcode, index: i + 1 })
    }

    // Load lookup tables
    const [existingProducts, categories, suppliers] = await Promise.all([
      db.product.findMany({ select: { id: true, sku: true, barcode: true } }),
      db.category.findMany({ select: { id: true, name: true } }),
      db.supplier.findMany({ select: { id: true, name: true } }),
    ])
    const bySku = new Map(existingProducts.map((p) => [p.sku.toUpperCase(), p]))
    const byBarcode = new Map(existingProducts.filter((p) => p.barcode).map((p) => [p.barcode!.toUpperCase(), p]))
    const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
    const supByName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]))

    let created = 0
    let updated = 0
    let skipped = 0

    const result = await db.$transaction(async (tx) => {
      const createdCatIds = new Map<string, string>()

      async function resolveCategory(name: string | null | undefined): Promise<string | null> {
        if (!name) return null
        const key = name.toLowerCase()
        if (catByName.has(key)) return catByName.get(key)!
        if (createdCatIds.has(key)) return createdCatIds.get(key)!
        if (!body.autoCreateCategories) return null
        const c = await tx.category.create({ data: { name: name.slice(0, 80) } })
        createdCatIds.set(key, c.id)
        return c.id
      }

      for (const r of parsed) {
        const categoryId = await resolveCategory(r.category)
        const supplierId = r.supplier ? (supByName.get(r.supplier.toLowerCase()) ?? null) : null
        const existing = r.sku ? bySku.get(r.sku) : undefined

        if (existing) {
          if (body.mode === 'skip') {
            skipped++
            continue
          }
          // update mode
          if (r.barcode && byBarcode.has(r.barcode) && byBarcode.get(r.barcode)!.id !== existing.id) {
            rowErrors.push({ row: r.index, message: `Barcode "${r.barcode}" belongs to another product` })
            continue
          }
          await tx.product.update({
            where: { id: existing.id },
            data: {
              name: r.name,
              barcode: r.barcode || null,
              unit: r.unit || 'pcs',
              categoryId,
              supplierId,
              costPrice: r.costPrice,
              price: r.price,
              taxRate: r.taxRate,
              reorderLevel: r.reorderLevel,
            },
          })
          updated++
          continue
        }

        // create
        const sku = r.sku || randomSku()
        if (r.barcode && byBarcode.has(r.barcode)) {
          rowErrors.push({ row: r.index, message: `Barcode "${r.barcode}" already exists` })
          continue
        }
        const stock = Math.round(r.stock ?? 0)
        const p = await tx.product.create({
          data: {
            sku,
            barcode: r.barcode || null,
            name: r.name,
            unit: r.unit || 'pcs',
            categoryId,
            supplierId,
            costPrice: r.costPrice,
            price: r.price,
            taxRate: r.taxRate ?? 0,
            stock,
            reorderLevel: r.reorderLevel ?? 5,
            isActive: true,
          },
        })
        bySku.set(sku.toUpperCase(), p)
        if (r.barcode) byBarcode.set(r.barcode, p)
        if (stock > 0) {
          await tx.stockMovement.create({
            data: {
              productId: p.id,
              type: 'PURCHASE',
              qty: stock,
              before: 0,
              after: stock,
              reference: 'IMPORT',
              note: 'Bulk import opening stock',
            },
          })
        }
        created++
      }

      return { created, updated, skipped }
    })

    return NextResponse.json({ ...result, errors: rowErrors, total: body.rows.length })
  } catch (e) {
    if (e instanceof z.ZodError) return bad(zodMsg(e))
    if (isUniqueError(e)) return bad('Duplicate SKU or barcode blocked the import — use "Skip existing" mode')
    if (e instanceof Prisma.PrismaClientKnownRequestError) return bad(`Database rejected the import: ${e.message.slice(0, 140)}`)
    console.error('POST /api/products/import error:', e)
    return bad('Failed to import products', 500)
  }
}
