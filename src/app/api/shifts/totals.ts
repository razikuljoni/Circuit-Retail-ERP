// ── Shift totals engine — shared by /api/shifts/current and /[id]/close ─────
// Computes live cash math over the window [from, to) for one shift:
//   transactions = count of COMPLETED sales
//   grossSales   = Σ total (COMPLETED)      refunds = Σ total (REFUNDED)
//   cash/card/mobileSales = Σ total per method (COMPLETED only)
//   expectedDrawer = openingFloat + cashSales − cash refunds (CASH refunds)
//   expensesPaid   = Σ Expense.amount (CASH method) inside the window
import { db } from '@/lib/db'
import { round2 } from '@/lib/api-utils'
import type { ShiftCurrent } from '@/lib/types'

export function zeroShiftTotals(): ShiftCurrent['totals'] {
  return {
    transactions: 0,
    grossSales: 0,
    refunds: 0,
    netSales: 0,
    cashSales: 0,
    cardSales: 0,
    mobileSales: 0,
    expectedDrawer: 0,
  }
}

export async function shiftTotals(from: Date, to: Date, openingFloat: number) {
  const window = { gte: from, lt: to }

  const [completedAgg, refundedAgg, cashAgg, cardAgg, mobileAgg, cashRefundAgg, cashExpenseAgg] =
    await Promise.all([
      db.sale.aggregate({
        where: { status: 'COMPLETED', createdAt: window },
        _count: true,
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { status: 'REFUNDED', createdAt: window },
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { status: 'COMPLETED', paymentMethod: 'CASH', createdAt: window },
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { status: 'COMPLETED', paymentMethod: 'CARD', createdAt: window },
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { status: 'COMPLETED', paymentMethod: 'MOBILE', createdAt: window },
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { status: 'REFUNDED', paymentMethod: 'CASH', createdAt: window },
        _sum: { total: true },
      }),
      // Cash-expense tracking: the Expense model carries paymentMethod (CASH | CARD | MOBILE | BANK)
      db.expense.aggregate({
        where: { spentAt: window, paymentMethod: 'CASH' },
        _sum: { amount: true },
      }),
    ])

  const grossSales = round2(completedAgg._sum.total ?? 0)
  const refunds = round2(refundedAgg._sum.total ?? 0)
  const cashSales = round2(cashAgg._sum.total ?? 0)
  const cashRefunds = round2(cashRefundAgg._sum.total ?? 0)

  return {
    totals: {
      transactions: completedAgg._count,
      grossSales,
      refunds,
      netSales: round2(grossSales - refunds),
      cashSales,
      cardSales: round2(cardAgg._sum.total ?? 0),
      mobileSales: round2(mobileAgg._sum.total ?? 0),
      expectedDrawer: round2(openingFloat + cashSales - cashRefunds),
    } satisfies ShiftCurrent['totals'],
    expensesPaid: round2(cashExpenseAgg._sum.amount ?? 0),
  }
}
