// Tiny, dependency-free CSV parser for the bulk-import dialog.
// Handles quoted fields, escaped quotes ("") , CRLF and skip-comment lines.

export interface ImportRow {
  name: string
  sku: string
  barcode: string
  category: string
  supplier: string
  unit: string
  cost: string
  price: string
  stock: string
  reorder: string
  tax: string
}

export interface ParsedCsv {
  rows: ImportRow[]
  errors: string[]
}

/** Header aliases → canonical keys. First matching column wins. */
const HEADER_ALIASES: Record<keyof ImportRow, string[]> = {
  name: ['name', 'product', 'product name', 'title', 'item'],
  sku: ['sku', 'code', 'item code', 'product code'],
  barcode: ['barcode', 'bar code', 'ean', 'upc'],
  category: ['category', 'cat', 'category name'],
  supplier: ['supplier', 'vendor', 'supplier name'],
  unit: ['unit', 'uom', 'measure'],
  cost: ['cost', 'costprice', 'cost price', 'buy', 'purchase price', 'buy price'],
  price: ['price', 'sell', 'selling price', 'retail', 'sale price', 'mrp'],
  stock: ['stock', 'qty', 'quantity', 'opening stock', 'inventory'],
  reorder: ['reorder', 'reorderlevel', 'reorder level', 'min', 'minstock', 'min stock', 'reorder point'],
  tax: ['tax', 'taxrate', 'tax rate', 'vat', 'vat %'],
}

const KEYS = Object.keys(HEADER_ALIASES) as (keyof ImportRow)[]

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',' || ch === '\t') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/** Detect the delimiter of the header line (comma vs tab vs semicolon). */
function detectDelimiter(line: string): string {
  const counts: Array<[string, number]> = [
    [',', (line.match(/,/g) ?? []).length],
    ['\t', (line.match(/\t/g) ?? []).length],
    [';', (line.match(/;/g) ?? []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][0] === ',' ? ',' : counts[0][0]
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export const CSV_TEMPLATE =
  'name,sku,category,cost,price,stock,reorder,unit,barcode,tax\n' +
  'Wireless Mouse M180,MS-101,Accessories,450,700,25,5,pcs,8941100010018,0\n' +
  'USB Hub 4-Port,UH-220,Accessories,320,550,15,5,pcs,,0\n' +
  'Rice Cooker 1.8L,RC-310,Home Appliances,1850,2600,8,3,pcs,,5'

/**
 * Parse raw CSV text into typed rows. Accepts flexible headers/aliases and
 * reports per-problem human-readable errors. Rows missing a name are errors.
 */
export function parseImportCsv(text: string, maxRows = 500): ParsedCsv {
  const errors: string[] = []
  const rows: ImportRow[] = []
  const clean = text.replace(/^\uFEFF/, '').trim()
  if (!clean) return { rows, errors: ['The file or pasted text is empty.'] }

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return { rows, errors: ['Need a header row plus at least one product row.'] }
  }

  const delim = detectDelimiter(lines[0])
  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader)
  const colMap = new Map<keyof ImportRow, number>()

  for (const key of KEYS) {
    const idx = headerCells.findIndex((h) => HEADER_ALIASES[key].includes(h))
    if (idx >= 0) colMap.set(key, idx)
  }

  if (!colMap.has('name')) {
    return {
      rows,
      errors: [
        `No "name" column found in the header. Expected a header like: ${CSV_TEMPLATE.split('\n')[0]}`,
      ],
    }
  }
  if (!colMap.has('price') && !colMap.has('cost')) {
    errors.push('Neither "price" nor "cost" column found — imported rows need at least a price.')
  }

  const get = (cells: string[], key: keyof ImportRow): string => {
    const idx = colMap.get(key)
    return idx === undefined ? '' : (cells[idx] ?? '').trim()
  }

  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1
    if (rows.length >= maxRows) {
      errors.push(`Stopped at ${maxRows} rows (import limit). Split larger files.`)
      break
    }
    const cells = splitCsvLine(lines[i])
    const name = get(cells, 'name')
    if (!name) {
      errors.push(`Row ${lineNo}: missing product name — row skipped.`)
      continue
    }
    const cost = get(cells, 'cost')
    const price = get(cells, 'price')
    if (!cost && !price) {
      errors.push(`Row ${lineNo} ("${name}"): no price or cost — row skipped.`)
      continue
    }
    rows.push({
      name,
      sku: get(cells, 'sku'),
      barcode: get(cells, 'barcode'),
      category: get(cells, 'category'),
      supplier: get(cells, 'supplier'),
      unit: get(cells, 'unit'),
      cost: cost || '0',
      price: price || cost || '0',
      stock: get(cells, 'stock') || '0',
      reorder: get(cells, 'reorder') || '5',
      tax: get(cells, 'tax') || '0',
    })
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('No usable product rows found.')
  }
  return { rows, errors }
}
