import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { customerId } = await params;

  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT * FROM customers WHERE customer_id = ?`,
      [customerId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer data" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  const { customerId } = await params;
  const { lead_source } = await request.json();

  // Basic validation
  if (!lead_source) {
    return NextResponse.json({ error: "Lead source is required." }, { status: 400 });
  }

  try {
    const conn = await getDbConnection();
    const [result] = await conn.execute(
      `UPDATE customers SET lead_source = ? , sales_representative = ? WHERE customer_id = ?`,
      [lead_source, lead_source, customerId]
    );
    // await conn.end();

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "No customer found with the provided ID or no change was made." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Lead source updated successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json(
      { error: "Failed to update lead source." },
      { status: 500 }
    );
  }
}