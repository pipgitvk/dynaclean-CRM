const { getDbConnection } = require('../db');

async function createFormAssignment(data) {
  const conn = await getDbConnection();
  const [result] = await conn.execute(
    `INSERT INTO meta_form_assignments (form_id, username, priority, max_leads, is_active)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE priority = VALUES(priority), max_leads = VALUES(max_leads), is_active = VALUES(is_active)`,
    [
      data.formId,
      data.username,
      data.priority || 0,
      data.maxLeads || 0,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1
    ]
  );
  return { id: result.insertId, ...data };
}

async function getAssignmentsByFormId(formId) {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT * FROM meta_form_assignments 
     WHERE form_id = ? AND is_active = 1 
     ORDER BY priority ASC, username ASC`,
    [formId]
  );
  return rows;
}

async function getAllAssignments() {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT * FROM meta_form_assignments 
     WHERE is_active = 1 
     ORDER BY form_id, priority ASC, username ASC`
  );
  return rows;
}

async function deleteFormAssignment(formId, username) {
  const conn = await getDbConnection();
  const [result] = await conn.execute(
    `DELETE FROM meta_form_assignments 
     WHERE form_id = ? AND username = ?`,
    [formId, username]
  );
  return result.affectedRows > 0;
}

async function deleteAllAssignmentsForForm(formId) {
  const conn = await getDbConnection();
  const [result] = await conn.execute(
    `DELETE FROM meta_form_assignments WHERE form_id = ?`,
    [formId]
  );
  return result.affectedRows;
}

module.exports = {
  createFormAssignment,
  getAssignmentsByFormId,
  getAllAssignments,
  deleteFormAssignment,
  deleteAllAssignmentsForForm
};
