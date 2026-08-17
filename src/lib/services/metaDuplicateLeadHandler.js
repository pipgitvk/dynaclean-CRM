const { getDbConnection } = require('../db');
const { checkPhoneDuplicate, normalizePhone } = require('../phone-check');
const {
  resolveAssigneeFromFormAssignments,
  resolveAssigneeFromLeadDistribution,
} = require('../leadDistributionResolver');

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
const HIDDEN_CUSTOMER_STATUSES = ['Invalid', 'Denied', 'DENIED'];

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

async function isEmployeeActive(username) {
  if (!username || username === 'Automatic') return false;

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    'SELECT status FROM rep_list WHERE username = ? LIMIT 1',
    [username]
  );

  return rows.length > 0 && Number(rows[0].status) === 1;
}

function getCustomerAssignee(customer) {
  const candidates = [
    customer.lead_source,
    customer.sales_representative,
    customer.assigned_to,
  ];

  for (const username of candidates) {
    if (username && username !== 'Automatic') return username;
  }

  return null;
}

async function resolveNextActiveAssignee(formId) {
  const candidates = [];

  if (formId) {
    const fromForm = await resolveAssigneeFromFormAssignments(formId);
    if (fromForm) candidates.push(fromForm);
  }

  try {
    const fromDistribution = await resolveAssigneeFromLeadDistribution();
    if (fromDistribution) candidates.push(fromDistribution);
  } catch (error) {
    console.warn('Lead distribution fallback unavailable:', error.message);
  }

  for (const username of [...new Set(candidates)]) {
    if (await isEmployeeActive(username)) return username;
  }

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT username FROM rep_list WHERE status = 1 ORDER BY username ASC LIMIT 1`
  );

  return rows[0]?.username || null;
}

function shouldResetCustomerStatus(status) {
  return HIDDEN_CUSTOMER_STATUSES.includes(String(status || '').trim());
}

/**
 * Duplicate lead handling:
 * - next_followup_date = lead arrival + 2 minutes
 * - inactive assignee -> reassign to next active sales person
 * - Denied/Invalid status -> reset to New
 * - always inserts a new customers_followup row (never updates latest row)
 */
async function setDuplicateLeadFollowupDate({
  customerId,
  leadArrivedAt,
  customer = null,
  formId = null,
}) {
  if (!customerId) {
    return { handled: false, reason: 'missing_customer_id' };
  }

  const conn = await getDbConnection();
  const now = new Date();
  const arrivedAt = resolveLeadArrivalDate(leadArrivedAt);
  const nextFollowupDate = addTwoMinutes(arrivedAt);

  let customerRow = customer;
  if (!customerRow || customerRow.status === undefined) {
    const [rows] = await conn.execute(
      `SELECT customer_id, first_name, phone, email, lead_source, sales_representative,
              assigned_to, status, stage
       FROM customers WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );
    if (!rows.length) {
      return { handled: false, reason: 'customer_not_found' };
    }
    customerRow = rows[0];
  }

  let assignee = getCustomerAssignee(customerRow);
  let reassigned = false;
  const employeeActive = assignee ? await isEmployeeActive(assignee) : false;

  if (!employeeActive) {
    const newAssignee = await resolveNextActiveAssignee(formId);
    if (!newAssignee) {
      return { handled: false, reason: 'no_active_assignee' };
    }
    assignee = newAssignee;
    reassigned = true;
  }

  const statusNeedsReset = shouldResetCustomerStatus(customerRow.status);
  const nextStatus = statusNeedsReset ? 'New' : customerRow.status;
  const nextStage = statusNeedsReset ? 'New' : customerRow.stage;

  if (reassigned) {
    await conn.execute(
      `UPDATE customers
       SET lead_source = ?, sales_representative = ?, assigned_to = 'Automatic',
           next_follow_date = ?, status = ?, stage = ?
       WHERE customer_id = ?`,
      [assignee, assignee, nextFollowupDate, nextStatus, nextStage, customerId]
    );

    await conn.execute(
      `UPDATE lead_distribution
       SET assigned_count = assigned_count + 1,
           last_assigned_at = ?
       WHERE UPPER(TRIM(username)) = UPPER(?)`,
      [now, assignee]
    );
  } else {
    await conn.execute(
      `UPDATE customers
       SET next_follow_date = ?, status = ?, stage = ?
       WHERE customer_id = ?`,
      [nextFollowupDate, nextStatus, nextStage, customerId]
    );
  }

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
      now,
      'Facebook',
      'Duplicate Meta lead re-enquiry',
      customerRow.email || '',
    ]
  );

  return {
    handled: true,
    customerId,
    assignee,
    reassigned,
    statusReset: statusNeedsReset,
    nextFollowupDate,
  };
}

async function handleDuplicateNotImportedLead({
  phone,
  leadArrivedAt = null,
  formId = null,
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
    formId,
  });
}

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
        ml.form_id,
        ml.created_at,
        c.customer_id,
        c.first_name,
        c.phone,
        c.email,
        c.lead_source,
        c.sales_representative,
        c.assigned_to,
        c.status,
        c.stage
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
        formId: row.form_id,
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
