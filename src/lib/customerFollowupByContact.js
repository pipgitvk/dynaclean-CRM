function phoneSegmentMatch(col, n) {
  return `RIGHT(REGEXP_REPLACE(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(${col}, '/', ','), ',', ${n}), ',', -1)), '[^0-9]', ''), 10) = ?`;
}

function phoneMatchBlock(col) {
  return `(${[1, 2, 3, 4, 5].map((n) => phoneSegmentMatch(col, n)).join(" OR ")})`;
}

/**
 * Latest customer follow-ups by contact / email — same rules as machines-followup history API.
 */
export async function fetchCustomerFollowupsByContact(
  conn,
  contact,
  email,
  { serviceSupportOnly = false } = {},
) {
  const phoneDigits = String(contact || "")
    .replace(/\D/g, "")
    .slice(-10);
  const emailNorm = String(email || contact || "")
    .trim()
    .toLowerCase();
  const isEmail = emailNorm.includes("@");

  const cond = [];
  const params = [];

  if (phoneDigits.length >= 10) {
    cond.push(phoneMatchBlock("cf.contact"));
    params.push(phoneDigits, phoneDigits, phoneDigits, phoneDigits, phoneDigits);
    cond.push(
      `cf.customer_id IN (SELECT customer_id FROM customers WHERE ${phoneMatchBlock("phone")})`,
    );
    params.push(phoneDigits, phoneDigits, phoneDigits, phoneDigits, phoneDigits);
  }

  if (isEmail) {
    cond.push("LOWER(TRIM(cf.email)) = ?");
    params.push(emailNorm);
    cond.push(
      "cf.customer_id IN (SELECT customer_id FROM customers WHERE LOWER(TRIM(email)) = ?)",
    );
    params.push(emailNorm);
  }

  if (!cond.length) return [];

  const supportFilter = serviceSupportOnly
    ? ` AND EXISTS (
          SELECT 1 FROM rep_list r
          WHERE r.username = cf.followed_by
            AND UPPER(TRIM(r.userRole)) = 'SERVICE SUPPORT'
        )`
    : "";

  const [rows] = await conn.execute(
    `SELECT
       cf.s_no,
       cf.customer_id,
       cf.name,
       cf.contact,
       cf.email,
       cf.followed_date,
       cf.next_followup_date,
       cf.service_next_followup,
       cf.comm_mode,
       cf.notes,
       cf.purpose,
       cf.followed_by,
       cf.time_stamp
     FROM customers_followup cf
     WHERE (${cond.join(" OR ")}) ${supportFilter}
     ORDER BY COALESCE(cf.followed_date, cf.time_stamp) DESC`,
    params,
  );
  return rows;
}