const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "u382069657_crm",
  password: "Crm@1990",
  database: "u382069657_crm",
  port: 3306,
  connectTimeout: 10000, // ⏳ optional
});

connection.connect((err) => {
  if (err) {
    console.error("❌ Connection error:", err);
  } else {
    console.log("✅ Connected to remote MySQL!");
  }
});
