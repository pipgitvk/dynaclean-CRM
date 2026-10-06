import dayjs from "dayjs";

const STAT_ORDER_WHERE = `
  DATE(no.created_at) >= ?
  AND DATE(no.created_at) <= ?
  AND no.approval_status = 'approved'
  AND COALESCE(no.is_cancelled, 0) = 0
`;

export function getPatPeriodFromQuery(searchParams) {
  const today = dayjs();
  const range = String(searchParams?.get("range") ?? "thisMonth").trim();
  let from;
  let to;
  let label;

  if (range === "thisYear") {
    from = today.startOf("year");
    to = today.endOf("day");
    label = `Calendar year ${today.year()}`;
  } else {
    from = today.startOf("month");
    to = today.endOf("day");
    label = from.format("MMMM YYYY");
  }

  return {
    dateFrom: from.format("YYYY-MM-DD"),
    dateTo: to.format("YYYY-MM-DD"),
    label,
    salaryMonth: from.format("YYYY-MM"),
  };
}

async function safeSum(conn, sql, params = []) {
  try {
    const [rows] = await conn.execute(sql, params);
    const v = rows?.[0]?.total ?? rows?.[0]?.t ?? rows?.[0]?.amount ?? 0;
    return Number(v) || 0;
  } catch {
    return 0;
  }
}

export async function fetchApprovedOrderTaxableRevenue(conn, dateFrom, dateTo) {
  const [result] = await conn.execute(
    `
      SELECT COALESCE(SUM(
        CASE
          WHEN qr.subtotal > 0 THEN qr.subtotal
          WHEN COALESCE(qi_sum.item_taxable, 0) > 0 THEN qi_sum.item_taxable
          WHEN no.baseAmount IS NOT NULL AND no.baseAmount != '' THEN no.baseAmount
          ELSE GREATEST(0, COALESCE(no.totalamt, 0) - COALESCE(no.taxamt, 0))
        END
      ), 0) AS taxable_amount
      FROM neworder no
      LEFT JOIN quotations_records qr ON no.quote_number = qr.quote_number
      LEFT JOIN (
        SELECT quote_number,
               SUM(COALESCE(total_taxable_amt, taxable_price, 0)) AS item_taxable
        FROM quotation_items
        GROUP BY quote_number
      ) qi_sum ON no.quote_number = qi_sum.quote_number
      WHERE ${STAT_ORDER_WHERE}
    `,
    [dateFrom, dateTo],
  );
  return Number(result[0]?.taxable_amount) || 0;
}

export async function buildAdminPatSummary(conn, { dateFrom, dateTo, periodLabel, salaryMonth }) {
  const revenueSales = await fetchApprovedOrderTaxableRevenue(conn, dateFrom, dateTo);

  const amcService = await safeSum(
    conn,
    `SELECT COALESCE(SUM(COALESCE(contract_amount, amc_amount, 0)), 0) AS total
     FROM amc_cmc
     WHERE status IN ('approved','Approved','paid','Paid')
       AND DATE(COALESCE(approved_time, created_time, amc_start_datetime)) >= ?
       AND DATE(COALESCE(approved_time, created_time, amc_start_datetime)) <= ?`,
    [dateFrom, dateTo],
  );

  const manualReceived = await safeSum(
    conn,
    `SELECT COALESCE(SUM(mpr.amount), 0) AS total
     FROM manual_payment_received mpr
     INNER JOIN manual_payment_pending mpp ON mpp.id = mpr.payment_id
     WHERE DATE(mpr.received_date) >= ? AND DATE(mpr.received_date) <= ?`,
    [dateFrom, dateTo],
  );

  const otherIncomeLines = [
    {
      id: "B1",
      label: "AMC / service charges",
      amount: amcService,
      expandHref: "/admin-dashboard/amc-cmc",
    },
    {
      id: "B2",
      label: "Machine repair / service income",
      amount: manualReceived,
      expandHref: "/admin-dashboard/manual-payments",
    },
    {
      id: "B3",
      label: "Spare-parts sales",
      amount: 0,
      expandHref: "/admin-dashboard/spare/purchase/purchases",
    },
    {
      id: "B4",
      label: "Installation / commissioning charges",
      amount: 0,
      expandHref: "/admin-dashboard/view_service_reports/upcoming-installation",
    },
    {
      id: "B5",
      label: "Freight recovered from customer",
      amount: 0,
      expandHref: "/admin-dashboard/order",
    },
    {
      id: "B6",
      label: "Scrap generated from manufacturing",
      amount: 0,
      expandHref: "/admin-dashboard/productions/status",
    },
  ];

  const otherOperatingIncome = otherIncomeLines.reduce((s, r) => s + r.amount, 0);
  const totalRevenue = revenueSales + otherOperatingIncome;

  const purchaseCogs = await safeSum(
    conn,
    `SELECT COALESCE(SUM(COALESCE(total_amount, grand_total, taxable_amount, 0)), 0) AS total
     FROM spare_purchase
     WHERE DATE(COALESCE(purchase_date, created_at)) >= ?
       AND DATE(COALESCE(purchase_date, created_at)) <= ?`,
    [dateFrom, dateTo],
  );

  const grossProfit = totalRevenue - purchaseCogs;

  const salaryBenefits = await safeSum(
    conn,
    `SELECT COALESCE(SUM(net_salary), 0) AS total
     FROM monthly_salary_records
     WHERE salary_month = ?
       AND LOWER(COALESCE(status, '')) IN ('approved', 'paid')`,
    [salaryMonth],
  );

  const expensesApproved = await safeSum(
    conn,
    `SELECT COALESCE(SUM(COALESCE(approved_amount, 0)), 0) AS total
     FROM expenses
     WHERE LOWER(COALESCE(approval_status, '')) NOT IN ('rejected', 'pending')
       AND DATE(COALESCE(TravelDate, payment_date)) >= ?
       AND DATE(COALESCE(TravelDate, payment_date)) <= ?`,
    [dateFrom, dateTo],
  );

  const nonSalaryExpenses = Math.max(0, expensesApproved - salaryBenefits);

  const expenseLines = [
    {
      id: "F7",
      label: "Employee Salary & Benefits",
      amount: salaryBenefits,
      expandHref: "/accounts-dashboard/salary/generate",
    },
    {
      id: "F8",
      label: "Sales & Marketing Expenses",
      amount: 0,
      expandHref: "/admin-dashboard/all-expenses",
    },
    {
      id: "F9",
      label: "Service & Warranty Expenses",
      amount: 0,
      expandHref: "/admin-dashboard/view_service_reports",
    },
    {
      id: "F10",
      label: "Rent & Utilities",
      amount: 0,
      expandHref: "/admin-dashboard/client-expenses",
    },
    {
      id: "F11",
      label: "Transportation / Freight",
      amount: 0,
      expandHref: "/admin-dashboard/all-expenses",
    },
    {
      id: "F12",
      label: "Administrative Expenses",
      amount: 0,
      expandHref: "/admin-dashboard/all-expenses",
    },
    {
      id: "F13",
      label: "Depreciation",
      amount: 0,
      expandHref: "/admin-dashboard/ledger",
    },
    {
      id: "F14",
      label: "Other expense categories (approved travel & expenses)",
      amount: nonSalaryExpenses,
      expandHref: "/admin-dashboard/all-expenses",
    },
  ];

  const totalExpenses = salaryBenefits + nonSalaryExpenses;
  const ebit = grossProfit - totalExpenses;
  const interest = 0;
  const pbt = ebit - interest;
  const currentTax = 0;
  const deferredTax = 0;
  const pat = pbt - currentTax - deferredTax;
  const patMargin = totalRevenue > 0 ? (pat / totalRevenue) * 100 : 0;

  return {
    periodLabel,
    dateFrom,
    dateTo,
    note: "All amounts ex-GST. Salary & approved expenses from CRM; other income / COGS use available tables. Tax & interest are zero until configured.",
    lines: {
      revenueSales: {
        id: "A",
        label: "Revenue from Sales",
        amount: revenueSales,
        expandHref: "/admin-dashboard/order",
      },
      otherOperatingIncome: {
        id: "B",
        label: "Other Operating Income",
        amount: otherOperatingIncome,
        children: otherIncomeLines,
      },
      totalRevenue: { id: "C", label: "Total Revenue (A + B)", amount: totalRevenue },
      purchaseCogs: {
        id: "D",
        label: "Less: Purchase Cost of Goods Sold / Manufacturing Cost",
        amount: purchaseCogs,
        expandHref: "/admin-dashboard/purchase/purchases",
      },
      grossProfit: { id: "E", label: "Gross Profit (C − D)", amount: grossProfit },
      expenses: {
        id: "F",
        label: "Expenses",
        amount: totalExpenses,
        children: expenseLines,
      },
      ebit: {
        id: "G",
        label: "EBIT / Operating Profit (E − F)",
        amount: ebit,
      },
      interest: { id: "15", label: "Interest / Finance Cost", amount: interest },
      pbt: { id: "H", label: "Profit Before Tax (G − 15)", amount: pbt },
      currentTax: { id: "16", label: "Less: Current Tax", amount: currentTax },
      deferredTax: { id: "17", label: "Less: Deferred Tax", amount: deferredTax },
      pat: { id: "I", label: "Profit After Tax (PAT)", amount: pat },
      patMargin: {
        id: "J",
        label: "PAT Margin (%) {(I ÷ C) × 100}",
        amount: patMargin,
        isPercent: true,
      },
    },
  };
}

export async function fetchPatDrillRows(conn, section, dateFrom, dateTo) {
  if (section === "revenue_sales") {
    const [rows] = await conn.execute(
      `
        SELECT no.order_id, no.quote_number, no.created_by,
               COALESCE(
                 CASE
                   WHEN qr.subtotal > 0 THEN qr.subtotal
                   WHEN COALESCE(qi_sum.item_taxable, 0) > 0 THEN qi_sum.item_taxable
                   WHEN no.baseAmount IS NOT NULL AND no.baseAmount != '' THEN no.baseAmount
                   ELSE GREATEST(0, COALESCE(no.totalamt, 0) - COALESCE(no.taxamt, 0))
                 END,
                 0
               ) AS taxable_amount
        FROM neworder no
        LEFT JOIN quotations_records qr ON no.quote_number = qr.quote_number
        LEFT JOIN (
          SELECT quote_number,
                 SUM(COALESCE(total_taxable_amt, taxable_price, 0)) AS item_taxable
          FROM quotation_items
          GROUP BY quote_number
        ) qi_sum ON no.quote_number = qi_sum.quote_number
        WHERE ${STAT_ORDER_WHERE}
        ORDER BY no.created_at DESC
        LIMIT 100
      `,
      [dateFrom, dateTo],
    );
    return rows.map((r) => ({
      id: r.order_id,
      col1: r.order_id,
      col2: r.quote_number || "—",
      col3: r.created_by || "—",
      amount: Number(r.taxable_amount) || 0,
    }));
  }

  if (section === "expenses") {
    const [rows] = await conn.execute(
      `
        SELECT ID, username, TravelDate, approved_amount, approval_status
        FROM expenses
        WHERE LOWER(COALESCE(approval_status, '')) NOT IN ('rejected', 'pending')
          AND DATE(COALESCE(TravelDate, payment_date)) >= ?
          AND DATE(COALESCE(TravelDate, payment_date)) <= ?
        ORDER BY TravelDate DESC
        LIMIT 100
      `,
      [dateFrom, dateTo],
    );
    return rows.map((r) => ({
      id: r.ID,
      col1: r.username || "—",
      col2: r.TravelDate ? String(r.TravelDate).slice(0, 10) : "—",
      col3: r.approval_status || "—",
      amount: Number(r.approved_amount) || 0,
    }));
  }

  return [];
}
