import dayjs from "dayjs";

const ORDER_APPROVED_SQL = `
  (
    LOWER(TRIM(COALESCE(no.approval_status, ''))) = 'approved'
    OR (
      COALESCE(no.sales_status, 0) = 1
      AND LOWER(TRIM(COALESCE(no.approval_status, ''))) NOT IN ('rejected', 'pending')
    )
  )
`;

const STAT_ORDER_WHERE = `
  DATE(no.created_at) >= ?
  AND DATE(no.created_at) <= ?
  AND ${ORDER_APPROVED_SQL}
  AND COALESCE(no.is_cancelled, 0) = 0
`;

/** AMC income: use invoice date when set (order may be created earlier). */
const AMC_STAT_ORDER_WHERE = `
  DATE(COALESCE(no.invoice_date, no.created_at)) >= ?
  AND DATE(COALESCE(no.invoice_date, no.created_at)) <= ?
  AND ${ORDER_APPROVED_SQL}
  AND COALESCE(no.is_cancelled, 0) = 0
`;

function parsePatDateInput(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = dayjs(s, "YYYY-MM-DD", true);
  return d.isValid() ? d : null;
}

export function getPatPeriodFromQuery(searchParams) {
  const today = dayjs();
  const rawFrom = String(
    searchParams?.get("dateFrom") ?? searchParams?.get("date_from") ?? "",
  ).trim();
  const rawTo = String(
    searchParams?.get("dateTo") ?? searchParams?.get("date_to") ?? "",
  ).trim();
  const range = String(searchParams?.get("range") ?? "").trim();

  let from;
  let to;
  let label;

  const parsedFrom = parsePatDateInput(rawFrom);
  const parsedTo = parsePatDateInput(rawTo);

  if (parsedFrom && parsedTo) {
    from = parsedFrom.startOf("day");
    to = parsedTo.startOf("day");
    if (from.isAfter(to)) {
      const swap = from;
      from = to;
      to = swap;
    }
    label = `${from.format("D MMM YYYY")} – ${to.format("D MMM YYYY")}`;
  } else if (range === "thisYear") {
    from = today.startOf("year");
    to = today.endOf("day");
    label = `Calendar year ${today.year()}`;
  } else {
    from = today.startOf("month");
    to = today.endOf("day");
    label = `${from.format("D MMM YYYY")} – ${to.format("D MMM YYYY")}`;
  }

  const salaryMonthFrom = from.format("YYYY-MM");
  const salaryMonthTo = to.format("YYYY-MM");

  return {
    dateFrom: from.format("YYYY-MM-DD"),
    dateTo: to.format("YYYY-MM-DD"),
    label,
    periodLabel: label,
    salaryMonthFrom,
    salaryMonthTo,
    /** @deprecated use salaryMonthFrom/salaryMonthTo */
    salaryMonth: salaryMonthFrom,
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

export async function fetchClientExpensesTotal(conn, dateFrom, dateTo) {
  return safeSum(
    conn,
    `SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) AS total
     FROM client_expenses
     WHERE DATE(created_at) >= ?
       AND DATE(created_at) <= ?`,
    [dateFrom, dateTo],
  );
}

async function fetchExpenseCategoryNames(conn) {
  try {
    const [rows] = await conn.execute(
      `SELECT name FROM expense_categories ORDER BY id ASC`,
    );
    return (rows || [])
      .map((r) => String(r.name || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** PAT Expenses (F) children: one row per expense head; sub-heads as nested children with +. */
export async function fetchPatExpenseHeadLines(
  conn,
  dateFrom,
  dateTo,
  salaryBenefits = 0,
) {
  const lines = [];
  let expenseLineSeq = 0;

  const pushExpenseLine = (row) => {
    expenseLineSeq += 1;
    const n = String(expenseLineSeq);
    lines.push({
      ...row,
      id: n,
      toggleKey: `F-${expenseLineSeq}`,
    });
  };

  if (Number(salaryBenefits) > 0) {
    pushExpenseLine({
      label: "Employee Salary & Benefits",
      amount: Number(salaryBenefits) || 0,
    });
  }

  let rows = [];
  try {
    [rows] = await conn.execute(
      `
        SELECT ce.id, ce.head, ce.amount,
               GROUP_CONCAT(DISTINCT cesh.sub_head ORDER BY cesh.sub_head SEPARATOR ', ') AS sub_heads
        FROM client_expenses ce
        LEFT JOIN client_expense_sub_heads cesh ON ce.id = cesh.client_expense_id
        WHERE DATE(ce.created_at) >= ?
          AND DATE(ce.created_at) <= ?
        GROUP BY ce.id, ce.head, ce.amount
      `,
      [dateFrom, dateTo],
    );
  } catch (e) {
    console.error("fetchPatExpenseHeadLines:", e);
    return lines;
  }

  const headMap = new Map();

  for (const r of rows || []) {
    const headLabel = String(r.head || "").trim() || "Unclassified";
    if (!headMap.has(headLabel)) {
      headMap.set(headLabel, {
        expenseTotal: 0,
        subMap: new Map(),
        noSubTotal: 0,
      });
    }
    const bucket = headMap.get(headLabel);
    const amt = Number(r.amount) || 0;
    bucket.expenseTotal += amt;

    const shList = String(r.sub_heads || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (shList.length === 0) {
      bucket.noSubTotal += amt;
    } else {
      for (const sh of shList) {
        bucket.subMap.set(sh, (bucket.subMap.get(sh) || 0) + amt);
      }
    }
  }

  const categoryNames = await fetchExpenseCategoryNames(conn);
  const catalogSet = new Set(categoryNames);
  const orderedHeadEntries = [];

  for (const name of categoryNames) {
    const bucket = headMap.get(name);
    if (bucket && bucket.expenseTotal > 0) {
      orderedHeadEntries.push([name, bucket]);
    }
  }

  for (const [headLabel, bucket] of [...headMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (!catalogSet.has(headLabel) && bucket.expenseTotal > 0) {
      orderedHeadEntries.push([headLabel, bucket]);
    }
  }

  for (const [headLabel, bucket] of orderedHeadEntries) {
    const headToggleKey = `F-${expenseLineSeq + 1}`;
    const subChildren = [...bucket.subMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([, amount]) => Number(amount) > 0)
      .map(([sh, amount], subIdx) => ({
        id: "",
        toggleKey: `${headToggleKey}-s-${subIdx}`,
        label: sh,
        amount,
      }));

    if (bucket.noSubTotal > 0 && subChildren.length > 0) {
      subChildren.push({
        id: "",
        toggleKey: `${headToggleKey}-s-other`,
        label: "Other (no sub-head)",
        amount: bucket.noSubTotal,
      });
    }

    pushExpenseLine({
      label: headLabel,
      amount: bucket.expenseTotal,
      ...(subChildren.length > 0 ? { children: subChildren } : {}),
    });
  }

  return lines;
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

/**
 * AMC/CAMC lines: quotation item_code may be SKU (AMC/CAMC) or products_list.item_code
 * (e.g. 1002500173) with item_name AMC/CAMC.
 */
const AMC_ITEM_MATCH_SQL = `
  (
    UPPER(TRIM(qi.item_code)) IN ('AMC', 'CAMC', 'CMC')
    OR UPPER(TRIM(qi.item_name)) IN ('AMC', 'CAMC')
    OR UPPER(qi.item_name) LIKE '%CAMC%'
    OR UPPER(qi.item_name) LIKE '%COMPREHENSIVE MAINTENANCE%'
    OR UPPER(qi.item_name) LIKE '%ANNUAL MAINTENANCE CONTRACT%'
    OR EXISTS (
      SELECT 1
      FROM products_list pl
      WHERE (
          TRIM(pl.item_code) = TRIM(qi.item_code)
          OR CAST(pl.product_number AS CHAR) = TRIM(qi.item_code)
        )
        AND (
          UPPER(TRIM(pl.item_name)) IN ('AMC', 'CAMC')
          OR UPPER(TRIM(pl.item_code)) IN ('AMC', 'CAMC', 'CMC')
        )
    )
  )
`;

const ORDER_QUOTATION_HEADER_JOIN = `
  INNER JOIN quotations_records qr ON (
    (no.quotation_id IS NOT NULL AND no.quotation_id > 0 AND qr.\`S.No.\` = no.quotation_id)
    OR (
      TRIM(COALESCE(no.quote_number, '')) <> ''
      AND TRIM(qr.quote_number) = TRIM(no.quote_number)
    )
  )
  INNER JOIN quotation_items qi
    ON TRIM(qi.quote_number) = TRIM(qr.quote_number)
`;

const AMC_QUOTATION_ITEMS_JOIN = `
  ${ORDER_QUOTATION_HEADER_JOIN}
   AND ${AMC_ITEM_MATCH_SQL}
`;

/** Service / repair income spares (e.g. spare_number 1110 Service Maintenance Charges). */
const MACHINE_REPAIR_SPARE_MATCH_SQL = `
  (
    NOT (${AMC_ITEM_MATCH_SQL})
    AND (
      EXISTS (
        SELECT 1
        FROM spare_list sl
        WHERE (
            CAST(sl.spare_number AS CHAR) = TRIM(qi.item_code)
            OR CAST(sl.id AS CHAR) = TRIM(qi.item_code)
          )
          AND (
            UPPER(sl.item_name) LIKE '%SERVICE%MAINTEN%'
            OR UPPER(sl.item_name) LIKE '%MAINTENECE%CHARGE%'
            OR UPPER(sl.item_name) LIKE '%REPARING CHARGE%'
            OR UPPER(sl.item_name) LIKE '%REPAIRING CHARGE%'
            OR UPPER(sl.item_name) LIKE '%REPAIR CHARGE%'
          )
      )
      OR UPPER(qi.item_name) LIKE '%SERVICE%MAINTEN%'
      OR UPPER(qi.item_name) LIKE '%MAINTENECE%CHARGE%'
      OR UPPER(qi.item_name) LIKE '%REPARING CHARGE%'
    )
  )
`;

const MACHINE_REPAIR_QUOTATION_ITEMS_JOIN = `
  ${ORDER_QUOTATION_HEADER_JOIN}
   AND ${MACHINE_REPAIR_SPARE_MATCH_SQL}
`;

/** Spare-parts sales: any spare_list line on the order quotation (excludes AMC & service-charge spares). */
const SPARE_PARTS_SALES_MATCH_SQL = `
  (
    EXISTS (
      SELECT 1
      FROM spare_list sl
      WHERE (
          CAST(sl.spare_number AS CHAR) = TRIM(qi.item_code)
          OR CAST(sl.id AS CHAR) = TRIM(qi.item_code)
        )
    )
    AND NOT (${AMC_ITEM_MATCH_SQL})
    AND NOT (${MACHINE_REPAIR_SPARE_MATCH_SQL})
  )
`;

const SPARE_PARTS_QUOTATION_ITEMS_JOIN = `
  ${ORDER_QUOTATION_HEADER_JOIN}
   AND ${SPARE_PARTS_SALES_MATCH_SQL}
`;

const AMC_LINE_TAXABLE_SQL = `
  COALESCE(
    NULLIF(qi.total_taxable_amt, 0),
    qi.taxable_price * COALESCE(qi.quantity, 1),
    qi.taxable_price,
    0
  )
`;

export async function fetchMachineRepairIncomeFromOrders(conn, dateFrom, dateTo) {
  try {
    const [rows] = await conn.execute(
      `SELECT COALESCE(SUM(${AMC_LINE_TAXABLE_SQL}), 0) AS total
       FROM neworder no
       ${MACHINE_REPAIR_QUOTATION_ITEMS_JOIN}
       WHERE ${AMC_STAT_ORDER_WHERE}`,
      [dateFrom, dateTo],
    );
    return Number(rows[0]?.total) || 0;
  } catch (e) {
    console.error("fetchMachineRepairIncomeFromOrders:", e);
    return 0;
  }
}

export async function fetchSparePartsSalesFromOrders(conn, dateFrom, dateTo) {
  try {
    const [rows] = await conn.execute(
      `SELECT COALESCE(SUM(${AMC_LINE_TAXABLE_SQL}), 0) AS total
       FROM neworder no
       ${SPARE_PARTS_QUOTATION_ITEMS_JOIN}
       WHERE ${AMC_STAT_ORDER_WHERE}`,
      [dateFrom, dateTo],
    );
    return Number(rows[0]?.total) || 0;
  } catch (e) {
    console.error("fetchSparePartsSalesFromOrders:", e);
    return 0;
  }
}

export async function fetchAmcServiceChargesFromOrders(conn, dateFrom, dateTo) {
  try {
    const [rows] = await conn.execute(
      `SELECT COALESCE(SUM(${AMC_LINE_TAXABLE_SQL}), 0) AS total
       FROM neworder no
       ${AMC_QUOTATION_ITEMS_JOIN}
       WHERE ${AMC_STAT_ORDER_WHERE}`,
      [dateFrom, dateTo],
    );
    return Number(rows[0]?.total) || 0;
  } catch (e) {
    console.error("fetchAmcServiceChargesFromOrders:", e);
    return 0;
  }
}

export async function buildAdminPatSummary(
  conn,
  { dateFrom, dateTo, periodLabel, salaryMonthFrom, salaryMonthTo, salaryMonth },
) {
  const revenueSales = await fetchApprovedOrderTaxableRevenue(conn, dateFrom, dateTo);

  const amcService = await fetchAmcServiceChargesFromOrders(conn, dateFrom, dateTo);
  const machineRepair = await fetchMachineRepairIncomeFromOrders(conn, dateFrom, dateTo);
  const sparePartsSales = await fetchSparePartsSalesFromOrders(conn, dateFrom, dateTo);

  const otherIncomeLines = [
    {
      id: "1",
      label: "AMC / service charges",
      amount: amcService,
      drillSection: "amc_service",
    },
    {
      id: "2",
      label: "Machine repair / service income",
      amount: machineRepair,
      drillSection: "machine_repair",
    },
    {
      id: "3",
      label: "Spare-parts sales",
      amount: sparePartsSales,
      drillSection: "spare_parts_sales",
    },
    {
      id: "4",
      label: "Installation / commissioning charges",
      amount: 0,
      expandHref: "/admin-dashboard/view_service_reports/upcoming-installation",
    },
    {
      id: "5",
      label: "Freight recovered from customer",
      amount: 0,
      expandHref: "/admin-dashboard/order",
    },
    {
      id: "6",
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

  const smFrom = salaryMonthFrom || salaryMonth;
  const smTo = salaryMonthTo || salaryMonth || smFrom;
  const salaryBenefits = await safeSum(
    conn,
    `SELECT COALESCE(SUM(net_salary), 0) AS total
     FROM monthly_salary_records
     WHERE salary_month >= ?
       AND salary_month <= ?
       AND LOWER(COALESCE(status, '')) IN ('approved', 'paid')`,
    [smFrom, smTo],
  );

  const expenseLines = await fetchPatExpenseHeadLines(
    conn,
    dateFrom,
    dateTo,
    salaryBenefits,
  );

  const totalExpenses = expenseLines.reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0,
  );
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
    note: "All amounts ex-GST. Salary from monthly_salary_records; operating expenses from client_expenses (by entry date). Tax & interest are zero until configured.",
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
        drillSection: "expenses",
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
    return fetchPatExpenseDrillByMonth(conn, dateFrom, dateTo);
  }

  if (section === "spare_parts_sales") {
    const [rows] = await conn.execute(
      `
        SELECT no.order_id,
               TRIM(qr.quote_number) AS quote_number,
               no.created_by,
               GROUP_CONCAT(
                 DISTINCT CONCAT(
                   TRIM(qi.item_code),
                   IF(TRIM(qi.item_name) <> '', CONCAT(' — ', qi.item_name), '')
                 )
                 ORDER BY qi.item_code SEPARATOR '; '
               ) AS spare_lines,
               SUM(${AMC_LINE_TAXABLE_SQL}) AS taxable_amount
        FROM neworder no
        ${SPARE_PARTS_QUOTATION_ITEMS_JOIN}
        WHERE ${AMC_STAT_ORDER_WHERE}
        GROUP BY no.order_id, qr.quote_number, no.created_by, no.created_at
        ORDER BY no.created_at DESC
        LIMIT 100
      `,
      [dateFrom, dateTo],
    );
    return rows.map((r) => ({
      id: r.order_id,
      col1: r.order_id,
      col2: r.quote_number || "—",
      col3: [r.spare_lines, r.created_by].filter(Boolean).join(" · ") || "—",
      amount: Number(r.taxable_amount) || 0,
    }));
  }

  if (section === "machine_repair") {
    const [rows] = await conn.execute(
      `
        SELECT no.order_id,
               TRIM(qr.quote_number) AS quote_number,
               no.created_by,
               GROUP_CONCAT(
                 DISTINCT CONCAT(
                   TRIM(qi.item_code),
                   IF(TRIM(qi.item_name) <> '', CONCAT(' — ', qi.item_name), '')
                 )
                 ORDER BY qi.item_code SEPARATOR '; '
               ) AS spare_lines,
               SUM(${AMC_LINE_TAXABLE_SQL}) AS taxable_amount
        FROM neworder no
        ${MACHINE_REPAIR_QUOTATION_ITEMS_JOIN}
        WHERE ${AMC_STAT_ORDER_WHERE}
        GROUP BY no.order_id, qr.quote_number, no.created_by, no.created_at
        ORDER BY no.created_at DESC
        LIMIT 100
      `,
      [dateFrom, dateTo],
    );
    return rows.map((r) => ({
      id: r.order_id,
      col1: r.order_id,
      col2: r.quote_number || "—",
      col3: [r.spare_lines, r.created_by].filter(Boolean).join(" · ") || "—",
      amount: Number(r.taxable_amount) || 0,
    }));
  }

  if (section === "amc_service") {
    const [rows] = await conn.execute(
      `
        SELECT no.order_id,
               TRIM(qr.quote_number) AS quote_number,
               no.created_by,
               no.quotation_id,
               GROUP_CONCAT(
                 DISTINCT CONCAT(
                   UPPER(TRIM(qi.item_code)),
                   IF(TRIM(qi.item_name) <> '', CONCAT(' (', qi.item_name, ')'), '')
                 )
                 ORDER BY qi.item_code SEPARATOR '; '
               ) AS amc_item_codes,
               SUM(${AMC_LINE_TAXABLE_SQL}) AS taxable_amount
        FROM neworder no
        ${AMC_QUOTATION_ITEMS_JOIN}
        WHERE ${AMC_STAT_ORDER_WHERE}
        GROUP BY no.order_id, qr.quote_number, no.created_by,
                 no.quotation_id, no.created_at
        ORDER BY no.created_at DESC
        LIMIT 100
      `,
      [dateFrom, dateTo],
    );
    return rows.map((r) => ({
      id: r.order_id,
      col1: r.order_id,
      col2: r.quote_number || "—",
      col3: [r.amc_item_codes, r.created_by].filter(Boolean).join(" · ") || "—",
      amount: Number(r.taxable_amount) || 0,
    }));
  }

  return [];
}

/** Client expenses for PAT drill-down, grouped by calendar month (newest month first). */
export async function fetchPatExpenseDrillByMonth(conn, dateFrom, dateTo) {
  const smFrom = dayjs(dateFrom).format("YYYY-MM");
  const smTo = dayjs(dateTo).format("YYYY-MM");
  const salaryBenefits = await safeSum(
    conn,
    `SELECT COALESCE(SUM(net_salary), 0) AS total
     FROM monthly_salary_records
     WHERE salary_month >= ?
       AND salary_month <= ?
       AND LOWER(COALESCE(status, '')) IN ('approved', 'paid')`,
    [smFrom, smTo],
  );
  const byHead = await fetchPatExpenseHeadLines(
    conn,
    dateFrom,
    dateTo,
    salaryBenefits,
  );

  const [rows] = await conn.execute(
    `
      SELECT id, expense_name, client_name, head, amount, created_at
      FROM client_expenses
      WHERE DATE(created_at) >= ?
        AND DATE(created_at) <= ?
      ORDER BY created_at DESC
    `,
    [dateFrom, dateTo],
  );

  const monthMap = new Map();

  for (const r of rows || []) {
    const created = r.created_at ? dayjs(r.created_at) : null;
    const monthKey = created?.isValid() ? created.format("YYYY-MM") : "unknown";
    const label = created?.isValid() ? created.format("MMMM YYYY") : "Unknown date";

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { monthKey, label, total: 0, rows: [] });
    }
    const bucket = monthMap.get(monthKey);
    const amount = Number(r.amount) || 0;
    bucket.total += amount;
    bucket.rows.push({
      id: r.id,
      col1: r.expense_name || "—",
      col2: r.client_name || "—",
      col3: r.head ? String(r.head) : created?.format("DD MMM YYYY") || "—",
      amount,
    });
  }

  const months = [...monthMap.values()].sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey),
  );

  const grandTotal = months.reduce((s, m) => s + m.total, 0);
  const lineCount = months.reduce((s, m) => s + m.rows.length, 0);

  return { byMonth: true, months, grandTotal, lineCount, byHead };
}
