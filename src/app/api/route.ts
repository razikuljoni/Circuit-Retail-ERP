// GET /api — service index: discoverable API surface + documentation pointers
import { NextResponse } from "next/server";
import { APP_NAME, APP_VERSION } from "@/lib/app-info";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    name: APP_NAME,
    version: APP_VERSION,
    status: "ok",
    health: "/api/health",
    docs: "See README.md and docs/ in the repository",
    endpoints: {
      dashboard: "GET /api/dashboard",
      notifications: "GET /api/notifications",
      products:
        "GET|POST /api/products · GET|PUT|DELETE /api/products/[id] · GET /api/products/[id]/detail · POST /api/products/import",
      categories:
        "GET|POST /api/categories · PUT|DELETE /api/categories/[id]",
      inventory:
        "GET /api/stock/movements · POST /api/stock/adjust · POST /api/stock/stocktake",
      purchaseOrders:
        "GET|POST /api/purchase-orders · GET|PUT|DELETE /api/purchase-orders/[id] · POST /api/purchase-orders/[id]/receive · POST /api/purchase-orders/bulk-draft",
      sales:
        "GET|POST /api/sales · GET /api/sales/[id] · POST /api/sales/[id]/refund · POST /api/sales/[id]/settle",
      shifts:
        "GET|POST /api/shifts · GET /api/shifts/current · POST /api/shifts/[id]/close",
      expenses:
        "GET|POST /api/expenses · PUT|DELETE /api/expenses/[id]",
      expenseCategories:
        "GET|POST /api/expense-categories · PUT|DELETE /api/expense-categories/[id]",
      expenseTemplates:
        "GET|POST /api/expense-templates · PUT|DELETE /api/expense-templates/[id] · POST /api/expense-templates/[id]/post",
      customers:
        "GET|POST /api/customers · GET|PUT|DELETE /api/customers/[id] · GET /api/customers/aging · POST /api/customers/[id]/settle-all",
      suppliers:
        "GET|POST /api/suppliers · PUT|DELETE /api/suppliers/[id] · GET /api/suppliers/[id]/statement",
      reports: "GET /api/reports",
      settings: "GET|PUT /api/settings",
      data: "GET /api/backup · POST /api/seed (protected in production)",
      meta: "GET /api (this document) · GET /api/health",
    },
  });
}
