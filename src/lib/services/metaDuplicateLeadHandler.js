const { getDbConnection } = require('../db');
const { checkPhoneDuplicate, normalizePhone } = require('../phone-check');
const {
  resolveAssigneeFromFormAssignments,
  resolveAssigneeFromLeadDistribution,
} = require('../leadDistributionResolver');

const HIDDEN_CUSTOMER_STATUSES = ['Invalid', 'Denied', 'DENIED'];

async function isEmployeeActive(username) {
  if (!username || username === 'Automatic') return false;

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    'SELECT status FROM rep_list WHERE username = ? LIMIT 1',
    [username]
  );

  return rows.length > 0 && Number(rows[0].status) === 1;
}

async function resolveNextActiveAssignee(formId) {
  const candidates = [];

  const fromForm = await resolveAssigneeFromFormAssignments(formId);
  if (fromForm) candidates.push(fromForm);

  try {
    const fromDistribution = await resolveAssigneeFromLeadDistribution();
    if (fromDistribution) candidates.push(fromDistribution);
  } catch (error) {
    console.warn('Lead distribution fallback unavailable:', error.message);
  }

  for (const username of candidates) {
    if (await isEmployeeActive(username)) return username;
  }

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT username FROM rep_list WHERE status = 1 ORDER BY username ASC LIMIT 1`
  );

  return rows[0]?.username || candidates[0] || null;
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

function buildModelLabel(productsInterest, customer) {
  const label = String(productsInterest || customer.products_interest || '').trim();
  return label || 'Unknown';
}

/**
 * Handle duplicate Meta lead where phone already exists in CRM (not imported).
 * - Active assignee: next follow-up 2 min after lead arrival, same user
 * - Inactive assignee: reassign to next active user + urgent follow-up (now, Automatic)
 * - Invalid/Denied status: reset to New so lead shows on employee dashboard
 */
async function handleDuplicateNotImportedLead({
  phone,
  formId,
  lead = {},
  productsInterest = '',
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

  const conn = await getDbConnection();
  const now = new Date();
  const arrivedAt = leadArrivedAt ? new Date(leadArrivedAt) : now;
  const safeArrivedAt = Number.isNaN(arrivedAt.getTime()) ? now : arrivedAt;

  const [custRows] = await conn.execute(
    `SELECT customer_id, status, stage, assigned_to, lead_source, sales_representative,
            first_name, phone, email, products_interest
     FROM customers
     WHERE customer_id = ?`,
    [dup.customerId]
  );

  if (!custRows.length) {
    return { handled: false, reason: 'customer_not_found' };
  }

  const customer = custRows[0];
  const modelLabel = buildModelLabel(productsInterest, customer);
  let assignee = getCustomerAssignee(customer);
  let reassigned = false;

  const employeeActive = assignee ? await isEmployeeActive(assignee) : false;

  let nextFollowupDate;
  let followedBy;
  let followupNote;

  if (!employeeActive) {
    const newAssignee = await resolveNextActiveAssignee(formId);
    if (!newAssignee) {
      return { handled: false, reason: 'no_active_assignee' };
    }

    assignee = newAssignee;
    reassigned = true;
    nextFollowupDate = now;
    followedBy = 'Automatic';
    followupNote = `Lead inquiry for ${modelLabel}`;

    await conn.execute(
      `UPDATE customers
       SET lead_source = ?, sales_representative = ?, assigned_to = 'Automatic'
       WHERE customer_id = ?`,
      [assignee, assignee, customer.customer_id]
    );

    await conn.execute(
      `UPDATE lead_distribution
       SET assigned_count = assigned_count + 1,
           last_assigned_at = ?
       WHERE UPPER(TRIM(username)) = UPPER(?)`,
      [now, assignee]
    );
  } else {
    nextFollowupDate = new Date(safeArrivedAt.getTime() + 2 * 60 * 1000);
    followedBy = assignee;
    followupNote = `Lead inquiry for ${modelLabel}`;
  }

  const statusNeedsReset = HIDDEN_CUSTOMER_STATUSES.includes(String(customer.status || '').trim());

  if (statusNeedsReset) {
    await conn.execute(
      `UPDATE customers
       SET status = 'New', stage = 'New', next_follow_date = ?
       WHERE customer_id = ?`,
      [nextFollowupDate, customer.customer_id]
    );
  } else {
    await conn.execute(
      `UPDATE customers SET next_follow_date = ? WHERE customer_id = ?`,
      [nextFollowupDate, customer.customer_id]
    );
  }

  const contactName = lead.first_name || customer.first_name || '';
  const contactPhone = normalizedPhone;
  const contactEmail = lead.email || customer.email || '';

  await conn.execute(
    `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date, followed_by,
        followed_date, communication_mode, notes, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customer.customer_id,
      contactName,
      contactPhone,
      nextFollowupDate,
      followedBy,
      now,
      'Facebook',
      followupNote,
      contactEmail,
    ]
  );

  console.log(
    `♻️ Duplicate lead handled for customer ${customer.customer_id}: assignee=${assignee}, reassigned=${reassigned}, followup=${nextFollowupDate.toISOString()}`
  );

  return {
    handled: true,
    customerId: customer.customer_id,
    assignee,
    reassigned,
    statusReset: statusNeedsReset,
    nextFollowupDate,
  };
}

module.exports = {
  handleDuplicateNotImportedLead,
  isEmployeeActive,
  resolveNextActiveAssignee,
};
