'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { api } from '@/lib/api'
import type { StoreSettings } from '@/lib/types'
import { useUiStore } from '@/store/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ProfileFormState {
  storeName: string
  phone: string
  address: string
  currency: string
  currencyCode: string
  taxRate: string
  receiptFooter: string
}

function initialState(s: StoreSettings): ProfileFormState {
  return {
    storeName: s.storeName,
    phone: s.phone ?? '',
    address: s.address ?? '',
    currency: s.currency,
    currencyCode: s.currencyCode,
    taxRate: String(s.taxRate ?? 0),
    receiptFooter: s.receiptFooter ?? '',
  }
}

export function ProfileForm({ initial }: { initial: StoreSettings }) {
  // Keyed by the parent on settings load, so state initializes fresh.
  const [form, setForm] = useState<ProfileFormState>(() => initialState(initial))
  const [saving, setSaving] = useState(false)

  const set =
    <K extends keyof ProfileFormState>(key: K) =>
    (value: ProfileFormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    if (!form.storeName.trim()) {
      toast.error('Store name is required')
      return
    }
    const tax = Number(form.taxRate)
    setSaving(true)
    try {
      const updated = await api.put<StoreSettings>('/api/settings', {
        storeName: form.storeName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        currency: form.currency.trim() || '৳',
        currencyCode: form.currencyCode.trim() || 'BDT',
        taxRate: Number.isFinite(tax) && tax >= 0 && tax <= 100 ? tax : 0,
        receiptFooter: form.receiptFooter.trim(),
      })
      // Sync the shell immediately (sidebar store card, POS currency, receipts)
      useUiStore.getState().setSettings(updated)
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Store profile</CardTitle>
        <CardDescription>Shown on receipts and across the app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-name">Store name *</Label>
            <Input
              id="set-name"
              value={form.storeName}
              onChange={(e) => set('storeName')(e.target.value)}
              placeholder="Circuit Electronics & More"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-phone">Phone</Label>
            <Input
              id="set-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone')(e.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="set-address">Address</Label>
          <Textarea
            id="set-address"
            rows={2}
            value={form.address}
            onChange={(e) => set('address')(e.target.value)}
            placeholder="Street, area, city"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-currency">Currency symbol</Label>
            <Input id="set-currency" value={form.currency} onChange={(e) => set('currency')(e.target.value)} placeholder="৳" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-currency-code">Currency code</Label>
            <Input
              id="set-currency-code"
              value={form.currencyCode}
              onChange={(e) => set('currencyCode')(e.target.value)}
              placeholder="BDT"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-tax">Default tax rate %</Label>
            <Input
              id="set-tax"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              value={form.taxRate}
              onChange={(e) => set('taxRate')(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="set-footer">Receipt footer</Label>
          <Textarea
            id="set-footer"
            rows={2}
            value={form.receiptFooter}
            onChange={(e) => set('receiptFooter')(e.target.value)}
            placeholder="Thank you for shopping with us!"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : <Save className="size-4" />}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
