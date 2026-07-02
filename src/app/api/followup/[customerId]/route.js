import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { convertISTtoUTC } from "@/lib/timezone";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

// GET: Fetch follow-up history for a customer
export async function GET(req, { params }) {
  const { customerId } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  let currentUser = null;
  let userRole = null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    currentUser = payload.username || null;
    userRole = payload.role || null;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
    });
  }

  const conn = await getDbConnection();

  let sql = `SELECT 
      followed_date,
      next_followup_date,
      comm_mode,
      notes,
      followed_by,
      time_stamp
     FROM customers_followup
     WHERE customer_id = ?`;

  let queryParams = [customerId];

  // Team Leader and Accountant can only see their own follow-up history for this customer
  if (userRole === "TEAM LEADER" || userRole === "ACCOUNTANT") {
    sql += ` AND followed_by = ?`;
    queryParams.push(currentUser);
  }

  sql += ` ORDER BY followed_date DESC`;

  const [rows] = await conn.execute(sql, queryParams);

  return new Response(JSON.stringify({ success: true, history: rows || [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req, { params }) {
  const { customerId } = await params;
  const data = await req.json();

  // Identify current user from JWT cookie
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  let followedBy = null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    followedBy = payload.username || null;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
    });
  }

  const conn = await getDbConnection();

  // First try to get from customers_followup (existing records), fallback to customers table
  let [rows] = await conn.execute(
    "SELECT name, contact, email FROM customers_followup WHERE customer_id = ? ORDER BY followed_date DESC LIMIT 1",
    [customerId],
  );

  let name, contact, email;

  if (rows.length > 0) {
    ({ name, contact, email } = rows[0]);
  } else {
    // Fallback to customers table
    const [customerRows] = await conn.execute(
      "SELECT name, phone, email FROM customers WHERE customer_id = ? LIMIT 1",
      [customerId],
    );

    if (customerRows.length === 0) {
      return new Response(JSON.stringify({ error: "Customer not found" }), { status: 404 });
    }

    ({ name, phone: contact, email } = customerRows[0]);
  }

  // Convert IST datetime to UTC before storing
  const followedDateUTC = convertISTtoUTC(data.followed_date);
  
  let nextFollowupDateUTC;
  
  // If status is Denied, automatically set next follow-up date to 4 days from now (UTC)
  if (data.status === "Denied") {
    const now = new Date();
    const fourDaysLater = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    nextFollowupDateUTC = fourDaysLater.toISOString();
  } else {
    nextFollowupDateUTC = convertISTtoUTC(data.next_followup_date);
  }

  await conn.execute(
    `INSERT INTO customers_followup 
    (customer_id, name, contact, email, next_followup_date, followed_date, comm_mode, notes, followed_by, multi_tag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      name,
      contact,
      email,
      nextFollowupDateUTC,
      followedDateUTC,
      data.communication_mode,
      data.notes,
      followedBy,
      data.multi_tag || null,
    ],
  );

  await conn.execute(
    `UPDATE customers SET status=?, stage=? WHERE customer_id=?`,
    [data.status, data.stage || "New", customerId],
  );

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
