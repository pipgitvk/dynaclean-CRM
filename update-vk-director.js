require('dotenv').config();
const mysql = require('mysql2/promise');

async function updateVkRole() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // Update VK's role to Director in rep_list
    const [result1] = await connection.execute(
      "UPDATE rep_list SET userRole = 'Director' WHERE username = 'VK'"
    );
    console.log(`Updated rep_list: ${result1.affectedRows} rows`);

    // Also check emplist
    const [result2] = await connection.execute(
      "UPDATE emplist SET userRole = 'Director' WHERE username = 'VK'"
    );
    console.log(`Updated emplist: ${result2.affectedRows} rows`);

    console.log('VK role updated to Director successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

updateVkRole();
