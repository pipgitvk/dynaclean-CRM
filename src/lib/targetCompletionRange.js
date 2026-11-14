function toYmd(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export function classifyTargetOrder(row) {
  const approval = String(row.approval_status || "")
    .toLowerCase()
    .trim();
  const cancelled = Number(row.is_cancelled) === 1;
  if (approval === "rejected") return "rejected";
  if (cancelled) return "cancelled";
  if (approval === "approved") return "approved";
  return "pending";
}

/**
 * Resolves employee, target amount, and order date window for target-completion APIs.
 */
export async function resolveTargetCompletionContext(db, searchParams) {
  const targetId = searchParams.get("targetId");
  const usernameParam = searchParams.get("username");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  let username;
  let startDate;
  let endDate;
  let target;
  let responseStartDate;
  let responseEndDate;

  if (targetId) {
    const [byId] = await db.execute(
      `SELECT username, target, target_start_date, target_end_date
       FROM target WHERE id = ?`,
      [targetId],
    );
    if (byId.length === 0) {
      return { found: false };
    }
    const row = byId[0];
    username = row.username;
    startDate = toYmd(row.target_start_date);
    endDate = toYmd(row.target_end_date);
    target = parseFloat(row.target);
    responseStartDate = row.target_start_date;
    responseEndDate = row.target_end_date;
    if (!startDate || !endDate) {
      return { found: false, invalidDates: true };
    }
  } else {
    if (!usernameParam || !startDateParam || !endDateParam) {
      return { found: false, missingParams: true };
    }
    username = usernameParam;
    startDate = startDateParam;
    endDate = endDateParam;

    const [targetRows] = await db.execute(
      `SELECT target, target_start_date, target_end_date
       FROM target
       WHERE username = ?
         AND target_start_date <= ?
         AND target_end_date >= ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [username, endDate, startDate],
    );

    if (targetRows.length === 0) {
      return { found: false };
    }

    target = parseFloat(targetRows[0].target);
    responseStartDate = targetRows[0].target_start_date;
    responseEndDate = targetRows[0].target_end_date;
  }

  let orderStart = startDate;
  let orderEnd = endDate;

  if (startDateParam && endDateParam) {
    const requestedStart = toYmd(startDateParam);
    const requestedEnd = toYmd(endDateParam);
    if (requestedStart && requestedEnd) {
      orderStart = orderStart > requestedStart ? orderStart : requestedStart;
      orderEnd = orderEnd < requestedEnd ? orderEnd : requestedEnd;
    }
  }

  if (monthParam != null && yearParam != null) {
    const m = parseInt(monthParam, 10);
    const y = parseInt(yearParam, 10);
    if (m >= 1 && m <= 12 && !Number.isNaN(y) && y >= 2000) {
      const pad = (n) => String(n).padStart(2, "0");
      const lastDay = new Date(y, m, 0).getDate();
      const monthStartStr = `${y}-${pad(m)}-01`;
      const monthEndStr = `${y}-${pad(m)}-${pad(lastDay)}`;
      orderStart = startDate > monthStartStr ? startDate : monthStartStr;
      orderEnd = endDate < monthEndStr ? endDate : monthEndStr;
    }
  }

  return {
    found: true,
    username,
    target,
    orderStart,
    orderEnd,
    target_start_date: responseStartDate,
    target_end_date: responseEndDate,
  };
}

export async function fetchTargetOrderRows(db, username, orderStart, orderEnd) {
  if (!orderStart || !orderEnd || orderStart > orderEnd) {
    return { approved: [], rejected: [], cancelled: [], pending: [] };
  }

  const [rows] = await db.execute(
    `SELECT
       no.order_id,
       no.quote_number,
       DATE(no.created_at) AS order_date,
       LOWER(TRIM(COALESCE(no.approval_status, ''))) AS approval_status,
       COALESCE(no.is_cancelled, 0) AS is_cancelled,
       IFNULL(SUM(qi.price_per_unit * qi.quantity), 0) AS amount
     FROM neworder no
     JOIN quotations_records qr
       ON no.quote_number = qr.quote_number
     LEFT JOIN quotation_items qi
       ON qr.quote_number = qi.quote_number
     WHERE qr.emp_name = ?
       AND DATE(no.created_at) >= ?
       AND DATE(no.created_at) <= ?
     GROUP BY no.order_id, no.quote_number, no.created_at, no.approval_status, no.is_cancelled
     ORDER BY no.created_at DESC`,
    [username, orderStart, orderEnd],
  );

  const buckets = {
    approved: [],
    rejected: [],
    cancelled: [],
    pending: [],
  };

  for (const row of rows || []) {
    const bucket = classifyTargetOrder(row);
    buckets[bucket].push({
      order_id: row.order_id,
      quote_number: row.quote_number,
      order_date: row.order_date,
      amount: parseFloat(row.amount || 0),
      approval_status: row.approval_status || "",
      is_cancelled: Number(row.is_cancelled) === 1,
    });
  }

  return buckets;
}