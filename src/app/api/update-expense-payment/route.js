import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  const body = await req.json();
  const { expenseId, paymentDate, paymentRef, notes } = body;

  let conn;

  try {
    conn = await getDbConnection();

    const result = await conn.query(
      `UPDATE expenses SET payment_date = ?, payment_ref = ?, notes = ? WHERE ID = ?`,
      [paymentDate, paymentRef, notes, expenseId]
    );



    return new Response("Payment details updated successfully", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
