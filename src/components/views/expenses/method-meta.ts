'use client'

import { Banknote, CreditCard, Landmark, Smartphone, type LucideIcon } from 'lucide-react'
import type { PaymentMethod } from '@/lib/types'

export const METHOD_META: Record<PaymentMethod, { label: string; icon: LucideIcon }> = {
  CASH: { label: 'Cash', icon: Banknote },
  CARD: { label: 'Card', icon: CreditCard },
  MOBILE: { label: 'Mobile', icon: Smartphone },
  BANK: { label: 'Bank', icon: Landmark },
}

export const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'MOBILE', 'BANK']
