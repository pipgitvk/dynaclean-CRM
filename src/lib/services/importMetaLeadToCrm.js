const { getDbConnection } = require('../db');
const { normalizePhone, PHONE_LAST10_WHERE } = require('../phone-check');
const { handleDuplicateNotImportedLead } = require('./metaDuplicateLeadHandler');

async function getDedicatedConnection() {
  const poolOrConn = await getDbConnection();
  if (typeof poolOrConn.getConnection === 'function') {
    const conn = await poolOrConn.getConnection();
    return { conn, shouldRelease: true };
  }
  return { conn: poolOrConn, shouldRelease: false };
}

/**
 * Named MySQL lock serializes CRM import for the same phone across
 * webhook, cron, and backfill (check-then-insert is not atomic otherwise).
 */
async function withPhoneImportLock(normalizedPhone, fn) {
  const lockName = `meta_crm_ph_${normalizedPhone}`.slice(0, 64);
  const { conn, shouldRelease } = await getDedicatedConnection();

  try {
    const [lockRows] = await conn.execute('SELECT GET_LOCK(?, 15) AS got', [lockName]);
    if (!lockRows[0] || Number(lockRows[0].got) !== 1) {
      throw new Error(`Could not acquire lead import lock for ${normalizedPhone}`);
    }

    try {
      return await fn(conn);
    } finally {
      try {
        await conn.execute('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (releaseErr) {
        console.error('Failed to release lead import lock', lockName, releaseErr);
      }
    }
  } finally {
    if (shouldRelease) conn.release();
  }
}

async function findExistingCustomerId(conn, normalizedPhone) {
  const [rows] = await conn.execute(
    `SELECT customer_id FROM customers WHERE ${PHONE_LAST10_WHERE} ORDER BY customer_id ASC LIMIT 1`,
    [normalizedPhone]
  );
  return rows[0]?.customer_id || null;
}

async function handleExistingCustomer({
  conn,
  customerId,
  first_name,
  email,
  phoneToStore,
  assignedTo,
  formId,
  duplicateMode,
}) {
  if (duplicateMode === 'skip') {
    return {
      imported: false,
      duplicate: true,
      handled: false,
      customerId,
      reason: 'phone_exists',
    };
  }

  if (duplicateMode === 'average') {
    const now = new Date();
    await conn.execute(`UPDATE customers SET status = ? WHERE customer_id = ?`, [
      'Average',
      customerId,
    ]);
    await conn.execute(
      `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date,
        followed_by, followed_date, communication_mode,
        notes, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        first_name,
        phoneToStore,
        now,
        assignedTo,
        now,
        'Facebook',
        'Re-Enquiry: urgent customer follow',
        email || '',
      ]
    );
    return {
      imported: false,
      duplicate: true,
      handled: true,
      customerId,
      reason: 're_enquiry_average',
    };
  }

  const duplicateResult = await handleDuplicateNotImportedLead({
    phone: phoneToStore,
    formId,
  });

  return {
    imported: false,
    duplicate: true,
    handled: Boolean(duplicateResult?.handled),
    customerId: duplicateResult?.customerId || customerId,
    reason: duplicateResult?.reason || 'duplicate_handled',
  };
}

/**
 * Insert a Meta/Facebook lead into `customers` once per phone.
 * If the phone already exists, updates the existing row instead of inserting.
 *
 * @param {object} opts
 * @param {'handler'|'average'|'skip'} [opts.duplicateMode]
 */
async function importMetaLeadToCrm({
  first_name,
  email,
  phone,
  address = '',
  lead_campaign = 'social_media',
  assignedTo,
  products_interest = '',
  followupNote = 'Lead from Facebook ad',
  nextFollowupDate = null,
  formId = null,
  incrementLeadDistribution = true,
  duplicateMode = 'handler',
} = {}) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length !== 10) {
    return { imported: false, duplicate: false, reason: 'invalid_phone' };
  }

  if (!assignedTo) {
    return { imported: false, duplicate: false, reason: 'missing_assignee' };
  }

  return withPhoneImportLock(normalizedPhone, async (conn) => {
    const existingId = await findExistingCustomerId(conn, normalizedPhone);
    if (existingId) {
      return handleExistingCustomer({
        conn,
        customerId: existingId,
        first_name,
        email,
        phoneToStore: normalizedPhone,
        assignedTo,
        formId,
        duplicateMode,
      });
    }

    const now = new Date();
    const [customerResult] = await conn.execute(
      `INSERT INTO customers (
          first_name, email, phone, address, lead_campaign,
          lead_source, sales_representative, assigned_to, status, date_created,
          products_interest, next_follow_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        first_name,
        email,
        normalizedPhone,
        address || '',
        lead_campaign,
        assignedTo,
        assignedTo,
        'Automatic',
        'New',
        now,
        products_interest || '',
        nextFollowupDate,
      ]
    );

    const customerId = customerResult.insertId;

    await conn.execute(
      `INSERT INTO customers_followup (
          customer_id, name, contact, next_followup_date, followed_by,
          followed_date, communication_mode, notes, email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        first_name,
        normalizedPhone,
        nextFollowupDate,
        assignedTo,
        now,
        'Facebook',
        followupNote,
        email || '',
      ]
    );

    if (incrementLeadDistribution) {
      await conn.execute(
        `UPDATE lead_distribution
           SET assigned_count = assigned_count + 1,
               last_assigned_at = ?
         WHERE UPPER(TRIM(username)) = UPPER(?)`,
        [now, assignedTo]
      );
    }

    return { imported: true, duplicate: false, customerId };
  });
}

module.exports = {
  importMetaLeadToCrm,
  withPhoneImportLock,
};
