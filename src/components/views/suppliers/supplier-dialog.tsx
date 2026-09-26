'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { api } from '@/lib/api'
import type { Supplier } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier | null
  onSaved: () => void
}) {
  const isEdit = supplier !== null
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (supplier) {
      setName(supplier.name)
      setPhone(supplier.phone ?? '')
      setEmail(supplier.email ?? '')
      setAddress(supplier.address ?? '')
      setNotes(supplier.notes ?? '')
    } else {
      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setNotes('')
    }
  }, [open, supplier])

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: trimmed,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      }
      if (isEdit) {
        await api.put(`/api/suppliers/${supplier.id}`, payload)
        toast.success(`Supplier "${trimmed}" updated`)
      } else {
        await api.post('/api/suppliers', payload)
        toast.success(`Supplier "${trimmed}" added`)
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
          <DialogDescription>Who you buy from — keep contacts handy for reorders.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Name *</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Company or person" autoFocus />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orders@company.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-address">Address</Label>
            <Input id="s-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Trade center, city" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-notes">Notes</Label>
            <Textarea id="s-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, delivery days…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : <Save className="size-4" />}
            {isEdit ? 'Save changes' : 'Add supplier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
