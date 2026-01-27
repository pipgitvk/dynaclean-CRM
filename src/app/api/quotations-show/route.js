// import { getDbConnection } from "@/lib/db";

// export async function GET(req) {
//   const { searchParams } = new URL(req.url);
//   const onlyMe = searchParams.get("only_me");
//   const username = searchParams.get("username");
//   const empName = searchParams.get("emp_name");
//   const fromDate = searchParams.get("from_date");
//   const toDate = searchParams.get("to_date");

//   const conn = await getDbConnection();
//   let query = `
//     SELECT
//       qr.quote_number,
//       qr.quote_date,
//       qr.company_name,
//       qr.grand_total,
//       qr.emp_name,
//       c.email,
//       c.phone
//     FROM quotations_records qr
//     LEFT JOIN customers c ON c.customer_id = qr.customer_id
//   `;
//   const values = [];

//   if (onlyMe && username) {
//     query += ` WHERE qr.emp_name = ?`;
//     values.push(username);
//   }
//   // if (empName) {
//   //   query +=
//   //     values.length > 0 ? ` AND qr.emp_name = ?` : ` WHERE qr.emp_name = ?`;
//   //   values.push(empName);
//   // }
//   if (empName) {
//     conditions.push(`qr.emp_name = ?`);
//     values.push(empName);
//   } else if (onlyMe && username) {
//     conditions.push(`qr.emp_name = ?`);
//     values.push(username);
//   }

//   if (fromDate && toDate) {
//     query +=
//       values.length > 0
//         ? ` AND qr.quote_date BETWEEN ? AND ?`
//         : ` WHERE qr.quote_date BETWEEN ? AND ?`;
//     values.push(fromDate, toDate);
//   }

//   query += ` ORDER BY qr.quote_date DESC`;

//   const [rows] = await conn.execute(query, values);
//   return Response.json(rows);
// }

import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const onlyMe = searchParams.get("only_me");
  const username = searchParams.get("username");
  const empName = searchParams.get("emp_name");
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");
  const customerName = searchParams.get("customer_name");
  const customerId = searchParams.get("customer_id");

  const conn = await getDbConnection();

  let query = `
  SELECT 
    qr.quote_number,
    qr.quote_date,
    qr.company_name,
    qr.grand_total,
    qr.emp_name,
    qr.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.email,
    c.phone
  FROM quotations_records qr
  LEFT JOIN customers c ON c.customer_id = qr.customer_id
`;

  const conditions = [];
  const values = [];

  // ✅ emp_name takes priority (even if username also exists)

  if (onlyMe && username) {
    query += ` WHERE qr.emp_name = ?`;
    values.push(username);
  } else if (empName) {
    conditions.push(`qr.emp_name = ?`);
    values.push(empName);
  }
  if (customerId) {
    conditions.push(`qr.customer_id = ?`);
    values.push(customerId);
  }
  if (customerName) {
    query +=
      values.length > 0
        ? ` AND CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) LIKE ?`
        : ` WHERE CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) LIKE ?`;

    values.push(`%${customerName}%`);
  }

  // ✅ Date filter
  if (fromDate && toDate) {
    conditions.push(`qr.quote_date BETWEEN ? AND ?`);
    values.push(fromDate, toDate);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(" AND ");
  }

  query += ` ORDER BY qr.quote_date DESC`;

  const [rows] = await conn.execute(query, values);
  return Response.json(rows);
}
