const { getDbConnection } = require('../db');

async function getSetting(key) {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    'SELECT setting_value FROM app_settings WHERE setting_key = ?',
    [key]
  );
  if (rows.length === 0) return null;
  return rows[0].setting_value;
}

async function setSetting(key, value) {
  const conn = await getDbConnection();
  await conn.execute(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = ?`,
    [key, value, value]
  );
  return value;
}

module.exports = {
  getSetting,
  setSetting
};
