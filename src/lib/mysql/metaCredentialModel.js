const { getDbConnection } = require('../db');
const { countLeadsByCredentialId } = require('./metaLeadModel');

/**
 * Meta Credential Model (MySQL)
 */

async function createCredential(data) {
  const conn = await getDbConnection();
  const [result] = await conn.execute(
    `INSERT INTO meta_credentials (employee_name, verify_token, page_id, page_token, form_ids, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.employeeName,
      data.verifyToken,
      data.pageId,
      data.pageToken,
      JSON.stringify(data.formIds),
      data.isActive !== undefined ? data.isActive : 1
    ]
  );
  return { id: result.insertId, ...data };
}

async function getAllCredentials(activeOnly = false) {
  const conn = await getDbConnection();
  const query = activeOnly 
    ? 'SELECT * FROM meta_credentials WHERE is_active = 1 ORDER BY created_at DESC'
    : 'SELECT * FROM meta_credentials ORDER BY created_at DESC';
  const [rows] = await conn.execute(query);
  
  const credentials = await Promise.all(rows.map(async (row) => {
    try {
      const leadsCount = await countLeadsByCredentialId(row.id);
      return {
        id: row.id,
        employeeName: row.employee_name,
        verifyToken: row.verify_token,
        pageId: row.page_id,
        pageToken: row.page_token,
        formIds: Array.isArray(JSON.parse(row.form_ids)) ? JSON.parse(row.form_ids) : [],
        isActive: Boolean(row.is_active),
        lastSyncAt: row.last_sync_at,
        lastSyncStatus: row.last_sync_status,
        lastSyncMessage: row.last_sync_message,
        totalLeadsFetched: row.total_leads_fetched,
        totalLeadsImported: leadsCount,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        _id: row.id.toString()
      };
    } catch (error) {
      console.error('Error parsing form_ids:', error, 'Raw value:', row.form_ids);
      return {
        id: row.id,
        employeeName: row.employee_name,
        verifyToken: row.verify_token,
        pageId: row.page_id,
        pageToken: row.page_token,
        formIds: [],
        isActive: Boolean(row.is_active),
        lastSyncAt: row.last_sync_at,
        lastSyncStatus: row.last_sync_status,
        lastSyncMessage: row.last_sync_message,
        totalLeadsFetched: row.total_leads_fetched,
        totalLeadsImported: 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        _id: row.id.toString()
      };
    }
  }));
  
  return credentials;
}

async function getCredentialById(id) {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    'SELECT * FROM meta_credentials WHERE id = ?',
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  try {
    return {
      id: row.id,
      employeeName: row.employee_name,
      verifyToken: row.verify_token,
      pageId: row.page_id,
      pageToken: row.page_token,
      formIds: Array.isArray(JSON.parse(row.form_ids)) ? JSON.parse(row.form_ids) : [],
      isActive: Boolean(row.is_active),
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
      totalLeadsImported: row.total_leads_imported || 0,
      lastSyncMessage: row.last_sync_message,
      totalLeadsFetched: row.total_leads_fetched,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      _id: row.id.toString()
    };
  } catch (error) {
    console.error('Error parsing form_ids:', error, 'Raw value:', row.form_ids);
    return {
      id: row.id,
      employeeName: row.employee_name,
      verifyToken: row.verify_token,
      pageId: row.page_id,
      pageToken: row.page_token,
      formIds: [],
      isActive: Boolean(row.is_active),
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
      totalLeadsImported: row.total_leads_imported || 0,
      lastSyncMessage: row.last_sync_message,
      totalLeadsFetched: row.total_leads_fetched,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      _id: row.id.toString()
    };
  }
}

async function updateCredential(id, data) {
  const conn = await getDbConnection();
  const updates = [];
  const values = [];
  
  if (data.employeeName !== undefined) {
    updates.push('employee_name = ?');
    values.push(data.employeeName);
  }
  if (data.verifyToken !== undefined) {
    updates.push('verify_token = ?');
    values.push(data.verifyToken);
  }
  if (data.pageId !== undefined) {
    updates.push('page_id = ?');
    values.push(data.pageId);
  }
  if (data.pageToken !== undefined) {
    updates.push('page_token = ?');
    values.push(data.pageToken);
  }
  if (data.formIds !== undefined) {
    updates.push('form_ids = ?');
    values.push(JSON.stringify(data.formIds));
  }
  if (data.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(data.isActive ? 1 : 0);
  }
  
  if (updates.length === 0) return null;
  
  values.push(id);
  await conn.execute(
    `UPDATE meta_credentials SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return getCredentialById(id);
}

async function deleteCredential(id) {
  const conn = await getDbConnection();
  const [result] = await conn.execute(
    'DELETE FROM meta_credentials WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

async function toggleCredentialActive(id) {
  const conn = await getDbConnection();
  await conn.execute(
    'UPDATE meta_credentials SET is_active = NOT is_active WHERE id = ?',
    [id]
  );
  return getCredentialById(id);
}

async function getActiveCredentials() {
  return getAllCredentials(true);
}

async function updateCredentialSync(id, syncData) {
  const conn = await getDbConnection();
  await conn.execute(
    `UPDATE meta_credentials 
     SET last_sync_at = ?, last_sync_status = ?, last_sync_message = ?, total_leads_fetched = total_leads_fetched + ?, total_leads_imported = total_leads_imported + ?
     WHERE id = ?`,
    [
      syncData.lastSyncAt || new Date(),
      syncData.status,
      syncData.message,
      syncData.leadsFetched || 0,
      syncData.leadsImported || 0,
      id
    ]
  );
  return getCredentialById(id);
}

module.exports = {
  createCredential,
  getAllCredentials,
  getCredentialById,
  updateCredential,
  deleteCredential,
  toggleCredentialActive,
  getActiveCredentials,
  updateCredentialSync
};
