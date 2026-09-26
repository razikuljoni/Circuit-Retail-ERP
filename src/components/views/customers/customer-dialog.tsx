'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { api } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSaved: () => void
}) {
  const isEdit = customer !== null
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (customer) {
      setName(customer.name)
      setPhone(customer.phone ?? '')
      setEmail(customer.email ?? '')
      setAddress(customer.address ?? '')
      setNotes(customer.notes ?? '')
    } else {
      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setNotes('')
    }
  }, [open, customer])

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
        await api.put(`/api/customers/${customer.id}`, payload)
        toast.success(`Customer "${trimmed}" updated`)
      } else {
        await api.post('/api/customers', payload)
        toast.success(`Customer "${trimmed}" added`)
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit customer' : 'Add customer'}</DialogTitle>
          <DialogDescription>Profiles power walk-in tracking and purchase history.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name *</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mail.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-address">Address</Label>
            <Input id="c-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Area, city" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferences, credit terms…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : <Save className="size-4" />}
            {isEdit ? 'Save changes' : 'Add customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
