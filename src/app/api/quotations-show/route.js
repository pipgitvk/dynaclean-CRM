import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const onlyMe = searchParams.get("only_me");
  const username = searchParams.get("username");
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");

  const conn = await getDbConnection();
  let query = `
    SELECT 
      qr.quote_number,
      qr.quote_date,
      qr.company_name,
      qr.grand_total,
      qr.emp_name,
      c.email,
      c.phone
    FROM quotations_records qr
    LEFT JOIN customers c ON c.customer_id = qr.customer_id
  `;
  const values = [];

  if (onlyMe && username) {
    query += ` WHERE qr.emp_name = ?`;
    values.push(username);
  }

  if (fromDate && toDate) {
    query += values.length > 0 ? ` AND qr.quote_date BETWEEN ? AND ?` : ` WHERE qr.quote_date BETWEEN ? AND ?`;
    values.push(fromDate, toDate);
  }

  query += ` ORDER BY qr.quote_date DESC`;

  const [rows] = await conn.execute(query, values);
  return Response.json(rows);
}
