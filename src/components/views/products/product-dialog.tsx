'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Save, TriangleAlert } from 'lucide-react'
import { api } from '@/lib/api'
import type { Category, Product, Supplier } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProductAvatar } from '@/components/shared/product-avatar'

export const PRODUCT_UNITS = ['pcs', 'box', 'kg', 'ltr', 'pack'] as const

const schema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(60, 'Max 60 characters'),
  name: z.string().trim().min(1, 'Name is required').max(200, 'Max 200 characters'),
  barcode: z.string().trim().max(60, 'Max 60 characters'),
  unit: z.string().min(1),
  categoryId: z.string(),
  supplierId: z.string(),
  costPrice: z
    .string()
    .trim()
    .min(1, 'Cost is required')
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, 'Enter a valid amount'),
  price: z
    .string()
    .trim()
    .min(1, 'Price is required')
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, 'Enter a valid amount'),
  taxRate: z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100), '0–100'),
  reorderLevel: z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Enter a valid number'),
  stock: z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Enter a valid number'),
  description: z.string().max(2000, 'Max 2000 characters'),
  imageUrl: z
    .string()
    .trim()
    .max(300_000, 'Image too large (max ~300KB for data URIs)')
    .refine(
      (v) => v === '' || /^https?:\/\/.+/i.test(v) || /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[\s\S]+$/i.test(v),
      'Must be an http(s) URL or a data:image URI'
    ),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  sku: '',
  name: '',
  barcode: '',
  unit: 'pcs',
  categoryId: 'none',
  supplierId: 'none',
  costPrice: '',
  price: '',
  taxRate: '0',
  reorderLevel: '5',
  stock: '0',
  description: '',
  imageUrl: '',
  isActive: true,
}

function toNum(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  suppliers,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  categories: Category[]
  suppliers: Supplier[]
  onSaved: () => void
}) {
  const isEdit = product !== null
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const [catValue, setCatValue] = useState('none')
  const [supValue, setSupValue] = useState('none')
  const [unitValue, setUnitValue] = useState('pcs')

  // Re-seed the form whenever the dialog opens for a different product
  useEffect(() => {
    if (!open) return
    if (product) {
      const next: FormValues = {
        sku: product.sku,
        name: product.name,
        barcode: product.barcode ?? '',
        unit: product.unit || 'pcs',
        categoryId: product.categoryId ?? 'none',
        supplierId: product.supplierId ?? 'none',
        costPrice: String(product.costPrice),
        price: String(product.price),
        taxRate: String(product.taxRate ?? 0),
        reorderLevel: String(product.reorderLevel ?? 0),
        stock: String(product.stock ?? 0),
        description: product.description ?? '',
        imageUrl: product.imageUrl ?? '',
        isActive: product.isActive,
      }
      reset(next)
      setCatValue(next.categoryId)
      setSupValue(next.supplierId)
      setUnitValue(next.unit)
    } else {
      reset(EMPTY)
      setCatValue('none')
      setSupValue('none')
      setUnitValue('pcs')
    }
  }, [open, product, reset])

  const priceNum = toNum(watch('price') ?? '0')
  const costNum = toNum(watch('costPrice') ?? '0')
  const belowCost = priceNum > 0 && costNum > 0 && priceNum < costNum

  const onSubmit = useMemo(
    () =>
      handleSubmit(async (v) => {
        const base = {
          sku: v.sku.trim().toUpperCase(),
          name: v.name.trim(),
          barcode: v.barcode.trim() || null,
          unit: unitValue || 'pcs',
          categoryId: catValue === 'none' ? null : catValue,
          supplierId: supValue === 'none' ? null : supValue,
          costPrice: toNum(v.costPrice),
          price: toNum(v.price),
          taxRate: v.taxRate.trim() === '' ? 0 : toNum(v.taxRate),
          reorderLevel: v.reorderLevel.trim() === '' ? 0 : toNum(v.reorderLevel),
          description: v.description.trim() || null,
          imageUrl: v.imageUrl.trim() || null,
        }
        try {
          if (isEdit && product) {
            await api.put(`/api/products/${product.id}`, { ...base, isActive: v.isActive })
            toast.success(`Product "${base.name}" updated`)
          } else {
            await api.post('/api/products', { ...base, stock: toNum(v.stock) })
            toast.success(`Product "${base.name}" created`)
          }
          onOpenChange(false)
          onSaved()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Failed to save product')
        }
      }),
    [handleSubmit, isEdit, product, unitValue, catValue, supValue, onOpenChange, onSaved]
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-5 pb-3 border-b">
          <SheetTitle>{isEdit ? 'Edit product' : 'Add product'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Update catalog details — stock changes happen in Inventory.' : 'Create a catalog item. Opening stock can be set below.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-sku">SKU *</Label>
                <Input id="p-sku" placeholder="e.g. CBL-USBC-1M" className="font-mono uppercase" {...register('sku')} />
                {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-barcode">Barcode</Label>
                <Input id="p-barcode" placeholder="Scan or type" className="font-mono" {...register('barcode')} />
                {errors.barcode && <p className="text-xs text-destructive">{errors.barcode.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name *</Label>
              <Input id="p-name" placeholder="Product name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={unitValue} onValueChange={setUnitValue}>
                  <SelectTrigger className="w-full" aria-label="Unit">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={catValue} onValueChange={setCatValue}>
                  <SelectTrigger className="w-full" aria-label="Category">
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Supplier</Label>
                <Select value={supValue} onValueChange={setSupValue}>
                  <SelectTrigger className="w-full" aria-label="Supplier">
                    <SelectValue placeholder="No supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supplier</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-cost">Cost price *</Label>
                <Input id="p-cost" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" {...register('costPrice')} />
                {errors.costPrice && <p className="text-xs text-destructive">{errors.costPrice.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-price">Selling price *</Label>
                <Input id="p-price" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" {...register('price')} />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-tax">Tax rate %</Label>
                <Input id="p-tax" type="number" inputMode="decimal" min={0} max={100} step="0.01" {...register('taxRate')} />
                {errors.taxRate && <p className="text-xs text-destructive">{errors.taxRate.message}</p>}
              </div>
            </div>

            {belowCost && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>Selling price is below cost — check your margin before saving.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-reorder">Reorder level</Label>
                <Input id="p-reorder" type="number" inputMode="numeric" min={0} step="1" {...register('reorderLevel')} />
                {errors.reorderLevel && <p className="text-xs text-destructive">{errors.reorderLevel.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-stock">Opening stock</Label>
                <Input
                  id="p-stock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="1"
                  disabled={isEdit}
                  {...register('stock')}
                />
                <p className="text-[11px] text-muted-foreground">
                  {isEdit ? 'Stock is managed in Inventory' : 'Logged as an opening-stock movement'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea id="p-desc" rows={3} placeholder="Optional notes about this product" {...register('description')} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-image">Product image URL</Label>
              <div className="flex items-start gap-3">
                <ProductAvatar
                  name={watch('name') || '?'}
                  imageUrl={watch('imageUrl') || null}
                  className="size-14 rounded-xl border border-border/60 bg-muted/40"
                  textClassName="text-base"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    id="p-image"
                    placeholder="https://… or data:image/png;base64,…"
                    className="font-mono text-xs"
                    {...register('imageUrl')}
                  />
                  {errors.imageUrl ? (
                    <p className="text-xs text-destructive">{errors.imageUrl.message}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Shown on POS tiles & product lists — falls back to initials when empty or broken.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {isEdit && (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <Label htmlFor="p-active" className="text-sm font-medium">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">Inactive products are archived from POS & lists</p>
                </div>
                <Switch id="p-active" checked={watch('isActive')} onCheckedChange={(c) => setValue('isActive', c)} />
              </div>
            )}
          </div>

          <SheetFooter className="p-5 pt-3 border-t mt-0 flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : <Save className="size-4" />}
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
