const { getDbConnection } = require('../db');

/**
 * Meta Lead Model (MySQL)
 */

function normalizeFormIds(rawValue) {
  if (rawValue === null || rawValue === undefined) return [];

  const coerceArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  };

  if (Array.isArray(rawValue)) {
    return coerceArray(rawValue);
  }

  if (typeof rawValue === 'number') {
    return [String(rawValue)];
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeFormIds(parsed);
    } catch (error) {
      if (trimmed.includes(',')) {
        return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
      }
      return [trimmed];
    }
  }

  if (typeof rawValue === 'object') {
    if (Array.isArray(rawValue.formIds)) return coerceArray(rawValue.formIds);
    if (Array.isArray(rawValue.form_ids)) return coerceArray(rawValue.form_ids);
  }

  return [];
}

function parseJsonValue(rawValue, fallback) {
  if (rawValue === null || rawValue === undefined) return fallback;

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return fallback;
    }
  }

  if (typeof rawValue === 'object') {
    return rawValue;
  }

  return fallback;
}

async function createLead(data) {
  const existing = await getLeadByLeadgenId(data.leadgenId);
  if (existing) {
    console.log(`⚠️ Duplicate lead ${data.leadgenId} in createLead — skipping insert`);
    return null;
  }

  const conn = await getDbConnection();
  try {
    const [result] = await conn.execute(
      `INSERT INTO meta_leads (leadgen_id, assigned_to, employee_name, form_id, page_id, lead_data, field_data, ad_id, campaign_name, products_interest)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.leadgenId,
        data.assignedTo,
        data.employeeName,
        data.formId,
        data.pageId,
        JSON.stringify(data.leadData),
        JSON.stringify(data.fieldData || []),
        data.adId || null,
        data.campaignName || null,
        data.productsInterest || null
      ]
    );
    return { id: result.insertId, ...data };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('Duplicate entry'))) {
      console.log(`⚠️ Duplicate lead ${data.leadgenId} in createLead — race condition`);
      return null;
    }
    throw error;
  }
}

async function getLeadByLeadgenId(leadgenId) {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    'SELECT * FROM meta_leads WHERE leadgen_id = ? ORDER BY id ASC LIMIT 1',
    [leadgenId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    leadData: parseJsonValue(row.lead_data, {}),
    fieldData: parseJsonValue(row.field_data, []),
    isImportedToCRM: Boolean(row.is_imported_to_crm),
    _id: row.id.toString()
  };
}

async function getAllLeads(filters = {}) {
  const conn = await getDbConnection();
  const useUnique = filters.unique !== false;
  let query;
  const values = [];

  if (useUnique) {
    query = `
      SELECT ml.* FROM meta_leads ml
      INNER JOIN (
        SELECT MIN(id) AS min_id
        FROM meta_leads
        WHERE leadgen_id IS NOT NULL AND leadgen_id != ''
        GROUP BY leadgen_id
      ) unique_leads ON ml.id = unique_leads.min_id
      WHERE 1=1
    `;
  } else {
    query = 'SELECT * FROM meta_leads WHERE 1=1';
  }

  const tablePrefix = useUnique ? 'ml.' : '';

  if (filters.assignedTo) {
    query += ` AND ${tablePrefix}assigned_to = ?`;
    values.push(filters.assignedTo);
  }
  if (filters.formId) {
    query += ` AND ${tablePrefix}form_id = ?`;
    values.push(filters.formId);
  }
  if (filters.isImported !== undefined) {
    query += ` AND ${tablePrefix}is_imported_to_crm = ?`;
    values.push(filters.isImported ? 1 : 0);
  }
  if (filters.startDate) {
    query += ` AND DATE(${tablePrefix}created_at) >= ?`;
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ` AND DATE(${tablePrefix}created_at) <= ?`;
    values.push(filters.endDate);
  }

  query += ` ORDER BY ${tablePrefix}created_at DESC`;
  
  if (filters.limit) {
    query += ' LIMIT ?';
    values.push(filters.limit);
  }
  
  if (filters.skip) {
    query += ' OFFSET ?';
    values.push(filters.skip);
  }
  
  const [rows] = await conn.execute(query, values);
  return rows.map(row => ({
    ...row,
    leadData: parseJsonValue(row.lead_data, {}),
    fieldData: parseJsonValue(row.field_data, []),
    isImportedToCRM: Boolean(row.is_imported_to_crm),
    _id: row.id.toString()
  }));
}

async function countLeads(filters = {}) {
  const conn = await getDbConnection();
  const useUnique = filters.unique !== false;
  let query;
  const values = [];

  if (useUnique) {
    query = `
      SELECT COUNT(*) AS count FROM (
        SELECT MIN(id) AS min_id
        FROM meta_leads
        WHERE leadgen_id IS NOT NULL AND leadgen_id != ''
    `;
    if (filters.assignedTo) {
      query += ' AND assigned_to = ?';
      values.push(filters.assignedTo);
    }
    if (filters.formId) {
      query += ' AND form_id = ?';
      values.push(filters.formId);
    }
    if (filters.isImported !== undefined) {
      query += ' AND is_imported_to_crm = ?';
      values.push(filters.isImported ? 1 : 0);
    }
    if (filters.startDate) {
      query += ' AND DATE(created_at) >= ?';
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND DATE(created_at) <= ?';
      values.push(filters.endDate);
    }
    query += ' GROUP BY leadgen_id) unique_leads';
  } else {
    let where = 'WHERE 1=1';
    if (filters.assignedTo) {
      where += ' AND assigned_to = ?';
      values.push(filters.assignedTo);
    }
    if (filters.formId) {
      where += ' AND form_id = ?';
      values.push(filters.formId);
    }
    if (filters.isImported !== undefined) {
      where += ' AND is_imported_to_crm = ?';
      values.push(filters.isImported ? 1 : 0);
    }
    if (filters.startDate) {
      where += ' AND DATE(created_at) >= ?';
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      where += ' AND DATE(created_at) <= ?';
      values.push(filters.endDate);
    }
    query = `SELECT COUNT(*) AS count FROM meta_leads ${where}`;
  }

  const [rows] = await conn.execute(query, values);
  return rows[0].count;
}

async function countLeadsByCredentialId(credentialId) {
  const conn = await getDbConnection();
  // Get credential's form_ids
  const [credRows] = await conn.execute(
    'SELECT form_ids FROM meta_credentials WHERE id = ?',
    [credentialId]
  );
  
  if (credRows.length === 0) return 0;
  
  const formIds = normalizeFormIds(credRows[0].form_ids);
  if (!Array.isArray(formIds) || formIds.length === 0) return 0;
  
  // Count leads for these specific form_ids
  const placeholders = formIds.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT COUNT(*) as count FROM meta_leads WHERE form_id IN (${placeholders}) AND is_imported_to_crm = 1`,
    formIds
  );
  return rows[0].count;
}

/**
 * Latest non-empty products_interest per form_id (most recent meta_leads row).
 * @param {string[]} formIds
 * @returns {Promise<Map<string, { products_interest: string, created_at: Date }>>}
 */
async function getLatestProductInterestMap(formIds = []) {
  const unique = [...new Set(
    (formIds || []).map((id) => String(id || '').trim()).filter(Boolean)
  )];
  const map = new Map();
  if (unique.length === 0) return map;

  const conn = await getDbConnection();
  const placeholders = unique.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT ml.form_id, ml.products_interest, ml.created_at
     FROM meta_leads ml
     INNER JOIN (
       SELECT form_id, MAX(id) AS max_id
       FROM meta_leads
       WHERE form_id IN (${placeholders})
         AND products_interest IS NOT NULL
         AND products_interest != ''
       GROUP BY form_id
     ) latest ON ml.id = latest.max_id`,
    unique
  );

  for (const row of rows) {
    const interest = String(row.products_interest || '').trim();
    if (!interest) continue;
    map.set(String(row.form_id), {
      products_interest: interest,
      created_at: row.created_at
    });
  }
  return map;
}

function pickLatestProductInterest(formIds, latestByFormId) {
  let best = null;
  for (const formId of formIds || []) {
    const row = latestByFormId.get(String(formId));
    if (!row?.products_interest) continue;
    if (!best || new Date(row.created_at) > new Date(best.created_at)) {
      best = row;
    }
  }
  return best?.products_interest || null;
}

async function markLeadAsImported(leadgenId, customerId) {
  const conn = await getDbConnection();
  await conn.execute(
    `UPDATE meta_leads SET is_imported_to_crm = 1, crm_customer_id = ? WHERE leadgen_id = ?`,
    [customerId, leadgenId]
  );
  return getLeadByLeadgenId(leadgenId);
}

async function findCredentialByFormId(formId) {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    'SELECT * FROM meta_credentials WHERE is_active = 1 AND JSON_CONTAINS(form_ids, ?)',
    [JSON.stringify(formId)]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    formIds: normalizeFormIds(row.form_ids),
    isActive: Boolean(row.is_active),
    _id: row.id.toString()
  };
}

module.exports = {
  createLead,
  getAllLeads,
  getLeadByLeadgenId,
  markLeadAsImported,
  countLeads,
  countLeadsByCredentialId,
  getLatestProductInterestMap,
  pickLatestProductInterest
};
