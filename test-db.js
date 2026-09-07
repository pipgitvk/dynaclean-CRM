const mysql = require("mysql2/promise");

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: "srv1871.hstgr.io",
      user: "u983728112_crm",
      password: "dH76ZhzY&",
      database: "u983728112_crm",
       passwordLength: DB_PASSWORD.length,
    });

    console.log("✅ Connected from Node!");
    await conn.end();
  } catch (e) {
    console.error(e);
  }
})();
