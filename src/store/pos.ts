// ── POS terminal state (zustand) ─────────────────────────────────────────────
// Owns: current cart, customer, discounts, note, payment method + held carts.
import { create } from 'zustand'
import { toast } from 'sonner'
import type { CartItem, PaymentMethod, Product } from '@/lib/types'

export const MIN_QTY = 0.001

export interface HeldCart {
  id: string
  savedAt: string
  cart: CartItem[]
  customerId: string | null
  orderDiscount: number
  note: string
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface CartTotals {
  subtotal: number
  itemDiscounts: number
  orderDiscount: number
  tax: number
  total: number
  count: number
}

/** Pure totals calculator — used by the cart panel, checkout and held-cart list. */
export function cartTotals(cart: CartItem[], orderDiscount: number): CartTotals {
  let subtotal = 0
  let itemDiscounts = 0
  let tax = 0
  let count = 0
  for (const item of cart) {
    const gross = item.unitPrice * item.qty
    const line = gross - item.discount
    subtotal += gross
    itemDiscounts += item.discount
    tax += (line * item.taxRate) / 100
    count += item.qty
  }
  subtotal = round2(subtotal)
  itemDiscounts = round2(itemDiscounts)
  tax = round2(tax)
  // Guard: order discount can never exceed everything else combined.
  const maxOrder = Math.max(0, round2(subtotal - itemDiscounts + tax))
  const effectiveOrder = Math.min(Math.max(0, round2(orderDiscount || 0)), maxOrder)
  const total = Math.max(0, round2(subtotal - itemDiscounts - effectiveOrder + tax))
  return { subtotal, itemDiscounts, orderDiscount: effectiveOrder, tax, total, count }
}

interface PosState {
  cart: CartItem[]
  customerId: string | null
  orderDiscount: number
  note: string
  paymentMethod: PaymentMethod
  held: HeldCart[]

  addItem: (product: Product, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  removeItem: (productId: string) => void
  setLineDiscount: (productId: string, amount: number) => void
  setCustomerId: (customerId: string | null) => void
  setOrderDiscount: (amount: number) => void
  setNote: (note: string) => void
  setPaymentMethod: (method: PaymentMethod) => void
  clearCart: () => void
  holdCart: () => void
  resumeCart: (id: string) => void
  deleteHeld: (id: string) => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `held-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  customerId: null,
  orderDiscount: 0,
  note: '',
  paymentMethod: 'CASH',
  held: [],

  addItem: (product, qty = 1) => {
    if (product.stock <= 0) {
      toast.error(`Out of stock — ${product.name}`)
      return
    }
    // Scanner prefix support: "3*SKU" adds 3 units in one go (clamped to stock)
    const add = Math.max(1, Math.floor(Number(qty) || 1))
    const existing = get().cart.find((i) => i.productId === product.id)
    if (existing) {
      if (existing.qty + add > existing.stock) {
        toast.warning(`Only ${existing.stock} in stock`)
        return
      }
      set({
        cart: get().cart.map((i) =>
          i.productId === product.id
            ? { ...i, qty: i.qty + add, stock: product.stock, unitPrice: product.price }
            : i
        ),
      })
      return
    }
    if (add > product.stock) {
      toast.warning(`Only ${product.stock} in stock`)
      return
    }
    const item: CartItem = {
      key: product.id,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      imageUrl: product.imageUrl ?? null,
      unitPrice: product.price,
      costPrice: product.costPrice,
      taxRate: product.taxRate,
      qty: add,
      discount: 0,
      stock: product.stock,
    }
    set({ cart: [...get().cart, item] })
  },

  setQty: (productId, qty) => {
    set({
      cart: get().cart.map((i) => {
        if (i.productId !== productId) return i
        let next = qty
        if (!Number.isFinite(next)) next = MIN_QTY
        if (next < MIN_QTY) next = MIN_QTY
        if (next > i.stock) {
          next = i.stock
          toast.warning(`Only ${i.stock} in stock`)
        }
        return { ...i, qty: round2(next) }
      }),
    })
  },

  removeItem: (productId) => {
    set({ cart: get().cart.filter((i) => i.productId !== productId) })
  },

  setLineDiscount: (productId, amount) => {
    set({
      cart: get().cart.map((i) => {
        if (i.productId !== productId) return i
        const max = i.unitPrice * i.qty
        const clamped = Math.min(Math.max(0, round2(amount || 0)), round2(max))
        return { ...i, discount: clamped }
      }),
    })
  },

  setCustomerId: (customerId) => set({ customerId }),
  setOrderDiscount: (amount) =>
    set({ orderDiscount: Math.max(0, round2(amount || 0)) }),
  setNote: (note) => set({ note }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),

  clearCart: () => set({ cart: [], customerId: null, orderDiscount: 0, note: '' }),

  holdCart: () => {
    const { cart, customerId, orderDiscount, note } = get()
    if (cart.length === 0) return
    const held: HeldCart = {
      id: newId(),
      savedAt: new Date().toISOString(),
      cart,
      customerId,
      orderDiscount,
      note,
    }
    set({ held: [held, ...get().held], cart: [], customerId: null, orderDiscount: 0, note: '' })
  },

  resumeCart: (id) => {
    const target = get().held.find((h) => h.id === id)
    if (!target) return
    // Park the current cart first so resuming never destroys work in progress.
    const current = get().cart
    const currentHeld: HeldCart[] =
      current.length > 0
        ? [
            {
              id: newId(),
              savedAt: new Date().toISOString(),
              cart: current,
              customerId: get().customerId,
              orderDiscount: get().orderDiscount,
              note: get().note,
            },
          ]
        : []
    set({
      cart: target.cart,
      customerId: target.customerId,
      orderDiscount: target.orderDiscount,
      note: target.note,
      held: [...currentHeld, ...get().held.filter((h) => h.id !== id)],
    })
  },

  deleteHeld: (id) => {
    set({ held: get().held.filter((h) => h.id !== id) })
  },
}))
