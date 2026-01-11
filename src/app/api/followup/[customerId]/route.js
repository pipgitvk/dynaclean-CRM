import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { convertISTtoUTC } from "@/lib/timezone";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function POST(req, { params }) {
  const customerId = params.customerId;
  const data = await req.json();

  // Identify current user from JWT cookie
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let followedBy = null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    followedBy = payload.username || null;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    "SELECT name, contact, email FROM customers_followup WHERE customer_id = ? ORDER BY followed_date DESC LIMIT 1",
    [customerId]
  );

  if (rows.length === 0) {
    return new Response("Customer data not found", { status: 404 });
  }

  const { name, contact, email } = rows[0];

  // Convert IST datetime to UTC before storing
  const followedDateUTC = convertISTtoUTC(data.followed_date);
  const nextFollowupDateUTC = convertISTtoUTC(data.next_followup_date);

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
    ]
  );


  await conn.execute(
    `UPDATE customers SET status=?, stage=? WHERE customer_id=?`,
    [data.status, data.stage || "New", customerId]
  );



  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
