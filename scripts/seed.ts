/**
 * Seed script — thin wrapper around src/lib/seed.ts (runSeed).
 * Run with: bun scripts/seed.ts
 */
import { runSeed } from '../src/lib/seed'

runSeed()
  .then((counts) => {
    console.log('✅ Seed complete:', JSON.stringify(counts))
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
