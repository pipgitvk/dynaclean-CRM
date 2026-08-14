const { getDbConnection } = require('../db');
const { checkPhoneDuplicate, normalizePhone } = require('../phone-check');

const CUSTOMER_PHONE_LAST10 = `
  RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10)
`;

const META_LEAD_PHONE_EXPR = `
  COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ml.lead_data, '$.phone')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ml.lead_data, '$.phone_number')), '')
  )
`;

const META_LEAD_PHONE_LAST10 = `
  RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${META_LEAD_PHONE_EXPR}, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10)
`;

const DUPLICATE_JOIN = `${META_LEAD_PHONE_LAST10} = ${CUSTOMER_PHONE_LAST10}`;

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function resolveLeadArrivalDate(leadArrivedAt) {
  const now = new Date();
  if (!leadArrivedAt) return now;
  const arrivedAt = new Date(leadArrivedAt);
  return Number.isNaN(arrivedAt.getTime()) ? now : arrivedAt;
}

function addTwoMinutes(fromDate) {
  return new Date(fromDate.getTime() + 2 * 60 * 1000);
}

/**
 * Set only next_followup_date to 2 minutes after lead arrival (customers + latest followup row).
 */
async function setDuplicateLeadFollowupDate({ customerId, leadArrivedAt, customer = null }) {
  if (!customerId) {
    return { handled: false, reason: 'missing_customer_id' };
  }

  const conn = await getDbConnection();
  const arrivedAt = resolveLeadArrivalDate(leadArrivedAt);
  const nextFollowupDate = addTwoMinutes(arrivedAt);

  let customerRow = customer;
  if (!customerRow) {
    const [rows] = await conn.execute(
      `SELECT customer_id, first_name, phone, email, lead_source, sales_representative
       FROM customers WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );
    if (!rows.length) {
      return { handled: false, reason: 'customer_not_found' };
    }
    customerRow = rows[0];
  }

  await conn.execute(
    `UPDATE customers SET next_follow_date = ? WHERE customer_id = ?`,
    [nextFollowupDate, customerId]
  );

  const [latestFollowupRows] = await conn.execute(
    `SELECT \`S.No.\` AS id FROM customers_followup
     WHERE customer_id = ?
     ORDER BY time_stamp DESC
     LIMIT 1`,
    [customerId]
  );

  if (latestFollowupRows.length > 0) {
    await conn.execute(
      `UPDATE customers_followup SET next_followup_date = ? WHERE \`S.No.\` = ?`,
      [nextFollowupDate, latestFollowupRows[0].id]
    );
  } else {
    const assignee =
      customerRow.lead_source && customerRow.lead_source !== 'Automatic'
        ? customerRow.lead_source
        : customerRow.sales_representative || 'Automatic';

    await conn.execute(
      `INSERT INTO customers_followup (
          customer_id, name, contact, next_followup_date, followed_by,
          followed_date, communication_mode, notes, email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        customerRow.first_name || '',
        customerRow.phone || '',
        nextFollowupDate,
        assignee,
        new Date(),
        'Facebook',
        '',
        customerRow.email || '',
      ]
    );
  }

  return {
    handled: true,
    customerId,
    nextFollowupDate,
  };
}

/**
 * Handle duplicate Meta lead where phone already exists in CRM (not imported).
 * Only updates next_followup_date to 2 minutes after lead arrival.
 */
async function handleDuplicateNotImportedLead({
  phone,
  leadArrivedAt = null,
}) {
  const dup = await checkPhoneDuplicate(phone);
  if (!dup.duplicate) {
    return { handled: false, reason: 'not_duplicate' };
  }

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length !== 10) {
    return { handled: false, reason: 'invalid_phone' };
  }

  return setDuplicateLeadFollowupDate({
    customerId: dup.customerId,
    leadArrivedAt,
  });
}

/**
 * Backfill follow-up dates for existing duplicate leads in a date range.
 */
async function processHistoricalDuplicateFollowups({ startDate, endDate } = {}) {
  const conn = await getDbConnection();

  const whereParts = [
    'ml.is_imported_to_crm = 0',
    `${META_LEAD_PHONE_EXPR} IS NOT NULL`,
    `${META_LEAD_PHONE_EXPR} != ''`,
  ];
  const queryParams = [];

  if (isValidDateString(startDate)) {
    whereParts.push('DATE(ml.created_at) >= ?');
    queryParams.push(startDate);
  }
  if (isValidDateString(endDate)) {
    whereParts.push('DATE(ml.created_at) <= ?');
    queryParams.push(endDate);
  }

  const [rows] = await conn.execute(
    `SELECT
        ml.id,
        ml.created_at,
        c.customer_id,
        c.first_name,
        c.phone,
        c.email,
        c.lead_source,
        c.sales_representative
     FROM meta_leads ml
     INNER JOIN customers c ON ${DUPLICATE_JOIN}
     WHERE ${whereParts.join(' AND ')}
     ORDER BY ml.created_at ASC`,
    queryParams
  );

  let processed = 0;
  let failed = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const result = await setDuplicateLeadFollowupDate({
        customerId: row.customer_id,
        leadArrivedAt: row.created_at,
        customer: row,
      });
      if (result.handled) processed += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      errors.push({ metaLeadId: row.id, customerId: row.customer_id, error: error.message });
    }
  }

  return {
    total: rows.length,
    processed,
    failed,
    errors: errors.slice(0, 20),
  };
}

module.exports = {
  handleDuplicateNotImportedLead,
  setDuplicateLeadFollowupDate,
  processHistoricalDuplicateFollowups,
};
