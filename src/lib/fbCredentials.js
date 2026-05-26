/**
 * Fetch Facebook credentials from database
 * Returns credentials or null if not found
 */
const { getDbConnection } = require("./db");

async function getFBCredentials() {
  try {
    const conn = await getDbConnection();

    // Fetch latest row from FB_credentials table
    const [rows] = await conn.execute(
      "SELECT FB_VERIFY_TOKEN, FB_PAGE_ID, FB_PAGE_TOKEN, FB_LEAD_FORM_ID FROM FB_credentials ORDER BY created_at DESC LIMIT 1"
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error('Error fetching FB credentials:', error);
    throw error;
  }
}

module.exports = { getFBCredentials };
