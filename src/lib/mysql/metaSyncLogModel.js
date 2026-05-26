const { getDbConnection } = require('../db');

/**
 * Meta Sync Log Model (MySQL)
 */

async function createSyncLog(data) {
  const conn = await getDbConnection();
  const [result] = await conn.execute(
    `INSERT INTO meta_sync_logs (credential_id, employee_name, sync_type, status, leads_fetched, leads_imported, leads_skipped, error_message, sync_duration, form_ids_processed, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.credentialId,
      data.employeeName,
      data.syncType,
      data.status,
      data.leadsFetched || 0,
      data.leadsImported || 0,
      data.leadsSkipped || 0,
      data.errorMessage || null,
      data.syncDuration || null,
      JSON.stringify(data.formIdsProcessed || []),
      new Date().toISOString().slice(0, 19).replace('T', ' ')
    ]
  );
  return { id: result.insertId, ...data };
}

async function getSyncLogs(filters = {}) {
  const conn = await getDbConnection();
  let query = 'SELECT * FROM meta_sync_logs WHERE 1=1';
  const values = [];
  
  if (filters.credentialId) {
    query += ' AND credential_id = ?';
    values.push(filters.credentialId);
  }
  
  query += ' ORDER BY synced_at DESC';
  
  if (filters.limit) {
    query += ' LIMIT ?';
    values.push(filters.limit);
  }
  
  const [rows] = await conn.execute(query, values);
  return rows.map(row => ({
    ...row,
    formIdsProcessed: JSON.parse(row.form_ids_processed || '[]'),
    _id: row.id.toString()
    }));
}

async function getSyncLogsWithCredentialInfo(filters = {}) {
  const conn = await getDbConnection();
  let query = `
    SELECT sl.*, mc.employee_name as credential_employee_name, mc.page_id
    FROM meta_sync_logs sl
    LEFT JOIN meta_credentials mc ON sl.credential_id = mc.id
    WHERE 1=1
  `;
  const values = [];
  
  if (filters.credentialId) {
    query += ' AND sl.credential_id = ?';
    values.push(filters.credentialId);
  }
  
  if (filters.startDate) {
    query += ' AND DATE(sl.synced_at) >= ?';
    values.push(filters.startDate);
  }
  
  if (filters.endDate) {
    query += ' AND DATE(sl.synced_at) <= ?';
    values.push(filters.endDate);
  }
  
  query += ' ORDER BY sl.synced_at DESC';
  
  if (filters.limit) {
    query += ' LIMIT ?';
    values.push(filters.limit);
  }
  
  const [rows] = await conn.execute(query, values);
  return rows.map(row => ({
    id: row.id,
    credentialId: row.credential_id.toString(),
    employeeName: row.employee_name,
    credentialEmployeeName: row.credential_employee_name,
    pageId: row.page_id,
    syncType: row.sync_type,
    status: row.status,
    leadsFetched: row.leads_fetched,
    leadsImported: row.leads_imported,
    leadsSkipped: row.leads_skipped,
    errorMessage: row.error_message,
    syncDuration: row.sync_duration,
    formIdsProcessed: JSON.parse(row.form_ids_processed || '[]'),
    syncedAt: row.synced_at,
    _id: row.id.toString()
  }));
}

module.exports = {
  createSyncLog,
  getSyncLogs,
  getSyncLogsWithCredentialInfo
};
