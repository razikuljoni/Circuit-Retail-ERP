'use client'

// Bulk product import: paste CSV or pick a file → client parse & preview → server import.
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileUp,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { fmtMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CSV_TEMPLATE, parseImportCsv, type ImportRow } from './import-csv'

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
  total: number
}

function toNum(v: string): number {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}) {
  const [tab, setTab] = useState<'file' | 'paste'>('paste')
  const [pasted, setPasted] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rawRows, setRawRows] = useState<ImportRow[] | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [mode, setMode] = useState<'skip' | 'update'>('skip')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const applyContent = useCallback((content: string, name: string | null) => {
    const parsed = parseImportCsv(content)
    setRawRows(parsed.rows)
    setParseErrors(parsed.errors)
    setFileName(name)
    setResult(null)
  }, [])

  const handlePaste = useCallback(
    (text: string) => {
      setPasted(text)
      if (text.trim()) applyContent(text, null)
      else {
        setRawRows(null)
        setParseErrors([])
      }
    },
    [applyContent]
  )

  const readFile = useCallback(
    (file: File) => {
      if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
        toast.error('Please choose a .csv, .tsv or .txt file')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const content = String(reader.result ?? '')
        setTab('file')
        applyContent(content, file.name)
      }
      reader.readAsText(file)
    },
    [applyContent]
  )

  const reset = useCallback(() => {
    setPasted('')
    setRawRows(null)
    setParseErrors([])
    setFileName(null)
    setResult(null)
    setMode('skip')
  }, [])

  const validRows = rawRows ?? []

  const payload = useMemo(
    () =>
      validRows.map((r) => ({
        name: r.name,
        sku: r.sku || null,
        barcode: r.barcode || null,
        category: r.category || null,
        supplier: r.supplier || null,
        unit: r.unit || null,
        costPrice: toNum(r.cost),
        price: toNum(r.price) || toNum(r.cost),
        stock: toNum(r.stock),
        reorderLevel: toNum(r.reorder),
        taxRate: toNum(r.tax),
      })),
    [validRows]
  )

  async function runImport() {
    if (payload.length === 0) return
    setImporting(true)
    try {
      const res = await api.post<ImportResult>('/api/products/import', {
        rows: payload,
        mode,
        autoCreateCategories: true,
      })
      setResult(res)
      const bits: string[] = []
      if (res.created) bits.push(`${res.created} created`)
      if (res.updated) bits.push(`${res.updated} updated`)
      if (res.skipped) bits.push(`${res.skipped} skipped`)
      if (res.errors?.length) bits.push(`${res.errors.length} rejected`)
      if (res.created || res.updated) toast.success(`Import finished — ${bits.join(', ')}`)
      else toast.error(`Nothing imported — ${bits.join(', ')}`)
      onImported()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasRows = validRows.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4.5 text-primary" />
            Bulk import products
          </DialogTitle>
          <DialogDescription>
            Import up to 500 products from a CSV file. Existing SKUs are skipped or updated — your choice.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'file' | 'paste')} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">
              <ClipboardPaste className="size-4 mr-1.5" />
              Paste CSV
            </TabsTrigger>
            <TabsTrigger value="file">
              <FileUp className="size-4 mr-1.5" />
              Choose file
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="mt-3 overflow-hidden flex flex-col">
            <Textarea
              value={pasted}
              onChange={(e) => handlePaste(e.target.value)}
              placeholder={CSV_TEMPLATE}
              className="font-mono text-xs min-h-36 flex-1 resize-none"
              aria-label="Paste CSV content"
              spellCheck={false}
            />
          </TabsContent>

          <TabsContent value="file" className="mt-3 overflow-hidden flex flex-col">
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose or drop a CSV file"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) readFile(f)
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40'
              }`}
            >
              <FileUp className="size-8 text-muted-foreground" />
              {fileName ? (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="gap-1">
                    {fileName}
                    <button
                      type="button"
                      aria-label="Clear file"
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFileName(null)
                        setRawRows(null)
                        setParseErrors([])
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop a CSV file here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">.csv / .tsv / .txt — up to 500 rows</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) readFile(f)
                  e.target.value = ''
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview */}
        {rawRows && (
          <div className="mt-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{validRows.length} row{validRows.length === 1 ? '' : 's'} ready</span>
                {parseErrors.length > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1">
                    <AlertTriangle className="size-3" />
                    {parseErrors.length} warning{parseErrors.length === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={downloadTemplate}>
                <Download className="size-3.5" />
                Template
              </Button>
            </div>

            {parseErrors.length > 0 && (
              <ul className="mb-2 space-y-0.5 max-h-20 overflow-y-auto text-xs text-amber-600 dark:text-amber-400" aria-live="polite">
                {parseErrors.slice(0, 6).map((er, i) => (
                  <li key={i} className="truncate">• {er}</li>
                ))}
                {parseErrors.length > 6 && <li>… and {parseErrors.length - 6} more</li>}
              </ul>
            )}

            <div className="rounded-lg border overflow-y-auto max-h-56">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur">
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validRows.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium max-w-44 truncate" title={r.name}>{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.sku || <span className="text-muted-foreground italic">auto</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(toNum(r.cost))}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtMoney(toNum(r.price) || toNum(r.cost))}</TableCell>
                      <TableCell className="text-right tabular-nums">{toNum(r.stock)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.category || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {validRows.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-1.5 border-t">
                  Showing first 50 of {validRows.length} rows
                </p>
              )}
            </div>

            {result ? (
              <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm space-y-1" aria-live="polite">
                <p className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  Done — {result.created} created, {result.updated} updated, {result.skipped} skipped
                  {result.errors.length > 0 && `, ${result.errors.length} rejected`}
                </p>
                {result.errors.slice(0, 4).map((er, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400 truncate">
                    Row {er.row}: {er.message}
                  </p>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3">
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'skip' | 'update')} className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="skip" id="mode-skip" />
                    <Label htmlFor="mode-skip" className="text-sm cursor-pointer">Skip existing SKUs</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="update" id="mode-update" />
                    <Label htmlFor="mode-update" className="text-sm cursor-pointer">Update existing SKUs</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 sm:justify-between">
          <p className="hidden sm:block text-xs text-muted-foreground self-center">
            New categories are created automatically · suppliers matched by name
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            <Button onClick={runImport} disabled={!hasRows || importing || result !== null}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {importing ? 'Importing…' : `Import ${hasRows ? validRows.length : ''} product${validRows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
