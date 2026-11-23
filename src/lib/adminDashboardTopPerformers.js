import {
  classifyLineItemTaxableAmount,
  loadAdminOrderListCatalogMaps,
} from "@/lib/adminOrderProductSpareTotals";

export function parseAdminDashboardStatsDateRange(
  timeRange,
  customDateFrom,
  customDateTo,
) {
  let startDate;
  let endDate;
  const today = new Date();

  if (
    timeRange === "custom" &&
    /^\d{4}-\d{2}-\d{2}$/.test(customDateFrom || "") &&
    /^\d{4}-\d{2}-\d{2}$/.test(customDateTo || "")
  ) {
    return { startDateStr: customDateFrom, endDateStr: customDateTo };
  }

  switch (timeRange) {
    case "today":
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "thisWeek": {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(d.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      break;
    }
    case "lastMonth":
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case "thisMonth":
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date();
      break;
  }

  const startDateStr =
    typeof startDate === "string"
      ? startDate
      : startDate.toISOString().slice(0, 10);
  const endDateStr =
    typeof endDate === "string" ? endDate : endDate.toISOString().slice(0, 10);

  return { startDateStr, endDateStr };
}

export async function fetchTopSalesPerformersWithProductSpare(
  conn,
  startDateStr,
  endDateStr,
) {
  const [{ catalogByCode, spareCatalogByCode }, [rows]] = await Promise.all([
    loadAdminOrderListCatalogMaps(conn),
    conn.execute(
      `
      SELECT
        CAST(qr.emp_name AS CHAR) COLLATE utf8mb4_unicode_ci AS salesperson,
        no.order_id,
        qi.item_code,
        qi.item_name,
        COALESCE(
          qi.total_taxable_amt,
          qi.taxable_price,
          qi.price_per_unit * qi.quantity,
          0
        ) AS taxable_amt
      FROM quotations_records qr
      INNER JOIN neworder no
        ON no.quote_number = qr.quote_number
        AND no.approval_status = 'approved'
        AND COALESCE(no.is_cancelled, 0) = 0
        AND DATE(no.created_at) >= ?
        AND DATE(no.created_at) <= ?
      INNER JOIN quotation_items qi ON qi.quote_number = no.quote_number
      WHERE qr.emp_name IS NOT NULL AND TRIM(qr.emp_name) <> ''
    `,
      [startDateStr, endDateStr],
    ),
  ]);

  const bySalesperson = new Map();

  for (const row of rows) {
    const salesperson = String(row.salesperson || "").trim();
    if (!salesperson) continue;

    let entry = bySalesperson.get(salesperson);
    if (!entry) {
      entry = {
        salesperson,
        orderIds: new Set(),
        revenue: 0,
        products_taxable: 0,
        spares_taxable: 0,
      };
    }

    entry.orderIds.add(row.order_id);
    const { type, amount } = classifyLineItemTaxableAmount(
      {
        item_code: row.item_code,
        item_name: row.item_name,
        taxable_amount: row.taxable_amt,
      },
      catalogByCode,
      spareCatalogByCode,
    );
    entry.revenue += amount;
    if (type === "spare") entry.spares_taxable += amount;
    else entry.products_taxable += amount;
    bySalesperson.set(salesperson, entry);
  }

  return [...bySalesperson.values()]
    .map((entry) => ({
      salesperson: entry.salesperson,
      orders_count: entry.orderIds.size,
      revenue: entry.revenue,
      products_taxable: entry.products_taxable,
      spares_taxable: entry.spares_taxable,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}