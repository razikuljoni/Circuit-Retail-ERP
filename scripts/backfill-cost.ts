/**
 * One-off data fix: earlier builds created SaleItems without a costPrice
 * snapshot (DB default 0), which overstated product-level margins in the
 * Products report. Backfill from the product's current costPrice.
 * Run with: bun scripts/backfill-cost.ts
 */
import { db } from '../src/lib/db'

async function main() {
  const items = await db.saleItem.findMany({
    where: { costPrice: 0, productId: { not: null } },
    select: { id: true, productId: true },
  })
  const products = await db.product.findMany({
    where: { costPrice: { gt: 0 } },
    select: { id: true, costPrice: true },
  })
  const cost = new Map(products.map((p) => [p.id, p.costPrice]))
  let n = 0
  for (const it of items) {
    const c = it.productId ? cost.get(it.productId) : undefined
    if (c && c > 0) {
      await db.saleItem.update({ where: { id: it.id }, data: { costPrice: c } })
      n++
    }
  }
  console.log(`backfilled ${n} of ${items.length} zero-cost SaleItems`)
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
