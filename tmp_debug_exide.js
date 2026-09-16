require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [o] = await c.execute(
    `SELECT order_id, quote_number, dispatch_status FROM neworder
     WHERE order_id IN ('20260916001', '20260911001') ORDER BY order_id DESC`,
  );
  console.log("orders:", o);

  for (const ord of o) {
    const [d] = await c.execute(
      `SELECT id, item_code, item_name, godown, stock_deducted, accessories_checklist, serial_no, updated_at
       FROM dispatch WHERE quote_number = ?`,
      [ord.quote_number],
    );
    console.log("\ndispatch for", ord.order_id, ":", JSON.stringify(d, null, 2));
  }

  const [pa] = await c.execute(
    `SELECT id, product_code, accessory_name, qty, spare_id, package_status
     FROM product_accessories WHERE accessory_name LIKE '%Exide%'`,
  );
  console.log("\nExide accessories:", pa);

  const [ss] = await c.execute(`SELECT * FROM stock_summary WHERE spare_id = 158`);
  console.log("\nstock_summary spare 158:", ss[0]);

  const [recent] = await c.execute(
    `SELECT id, spare_id, quantity, stock_status, note, godown, total, delhi, south, Delhi, South, created_at
     FROM stock_list WHERE spare_id = 158 ORDER BY created_at DESC LIMIT 8`,
  );
  console.log("\nrecent stock_list:", recent);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
