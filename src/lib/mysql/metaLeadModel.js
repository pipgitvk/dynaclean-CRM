const { getDbConnection } = require('../db');

/**
 * Meta Lead Model (MySQL)
 */

async function createLead(data) {
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
    // Handle duplicate key error - return null instead of throwing
    if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('Duplicate entry'))) {
      console.log(`⚠️ Duplicate lead ${data.leadgenId} in createLead`);
      return null;
    }
    throw error;
  }
}

async function getLeadByLeadgenId(leadgenId) {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    'SELECT * FROM meta_leads WHERE leadgen_id = ?',
    [leadgenId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    leadData: JSON.parse(row.lead_data),
    fieldData: JSON.parse(row.field_data || '[]'),
    isImportedToCRM: Boolean(row.is_imported_to_crm),
    _id: row.id.toString()
  };
}

async function getAllLeads(filters = {}) {
  const conn = await getDbConnection();
  let query = 'SELECT * FROM meta_leads WHERE 1=1';
  const values = [];
  
  // For skipped leads, get unique leads by leadgen_id
  if (filters.isImported === false && filters.unique) {
    query = 'SELECT ml.* FROM meta_leads ml INNER JOIN (SELECT MIN(id) as min_id FROM meta_leads WHERE is_imported_to_crm = 0 GROUP BY leadgen_id) unique_leads ON ml.id = unique_leads.min_id';
  }
  
  if (!filters.unique) {
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
  }
  
  query += ' ORDER BY created_at DESC';
  
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
    leadData: JSON.parse(row.lead_data),
    fieldData: JSON.parse(row.field_data || '[]'),
    isImportedToCRM: Boolean(row.is_imported_to_crm),
    _id: row.id.toString()
  }));
}

async function countLeads(filters = {}) {
  const conn = await getDbConnection();
  let where = 'WHERE 1=1';
  const values = [];
  
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
  
  const [rows] = await conn.execute(`SELECT COUNT(*) as count FROM meta_leads ${where}`, values);
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
  
  const formIds = JSON.parse(credRows[0].form_ids);
  if (!Array.isArray(formIds) || formIds.length === 0) return 0;
  
  // Count leads for these specific form_ids
  const placeholders = formIds.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT COUNT(*) as count FROM meta_leads WHERE form_id IN (${placeholders}) AND is_imported_to_crm = 1`,
    formIds
  );
  return rows[0].count;
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
    formIds: JSON.parse(row.form_ids),
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
  countLeadsByCredentialId
};
