// POST /api/expense-templates/[id]/post — post a real expense from a template.
// Creates an Expense dated now (store-local), stamps lastPostedAt on the
// template, and returns the created expense (with category included).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bad } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const template = await db.expenseTemplate.findUnique({ where: { id }, include: { category: true } })
    if (!template) return bad('Template not found', 404)
    if (!template.active) return bad('This template is inactive — reactivate it before posting')

    const expense = await db.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          title: template.title,
          categoryId: template.categoryId,
          amount: template.amount,
          paymentMethod: template.paymentMethod,
          spentAt: new Date(),
          note: template.note ?? null,
          reference: `TPL:${template.title.slice(0, 40)}`,
        },
        include: { category: true },
      })
      await tx.expenseTemplate.update({
        where: { id: template.id },
        data: { lastPostedAt: new Date() },
      })
      return created
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (e) {
    console.error('POST /api/expense-templates/[id]/post error:', e)
    return bad('Failed to post expense from template', 500)
  }
}
