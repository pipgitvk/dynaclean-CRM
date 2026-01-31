// app/api/lead-distribute-Indiamart/route.js

import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  try {
    const { fields } = await req.json();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const next_followup_date = now;
    const createdby = fields.lead_source || "manual";

    const conn = await getDbConnection();

    // ✅ Check for duplicate phone
    if (fields.phone) fields.phone = fields.phone.trim();

    const [dupRows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM customers WHERE phone = ?`,
      [fields.phone],
    );
    if (dupRows[0].c > 0) {
      // await conn.end();
      return NextResponse.json(
        { error: "Duplicate phone number" },
        { status: 409 },
      );
    }

    // ✅ Insert into customers
    const [customerResult] = await conn.execute(
      `INSERT INTO customers (
        first_name, last_name, email, phone, address, company,
        lead_source, lead_campaign, status,
        followup_notes, communication_history, products_interest,
        sales_representative, assigned_to, tags, notes,
        next_follow_date, date_created, visiting_card
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fields.first_name,
        fields.last_name || "",
        fields.email || "",
        fields.phone,
        fields.address || "",
        fields.company || "",
        createdby,
        fields.lead_campaign || "Unknown",
        "New",
        fields.followup_notes || "",
        fields.communication_history || "",
        fields.products_interest,
        createdby,
        fields.assigned_to,
        fields.tags,
        fields.notes,
        next_followup_date,
        now,
        fields.visiting_card || "",
      ],
    );

    const customerId = await customerResult.insertId;

    // ✅ Insert into follow-up table
    await conn.execute(
      `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date,
        followed_date, followed_by,communication_mode, notes, email
      )
      VALUES (?, ?, ?, ?, ?, ?, ?,?, ?)`,
      [
        customerId,
        fields.first_name,
        fields.phone,
        next_followup_date,
        now,
        createdby,
        fields.communication_mode,
        fields.notes,
        fields.email || "",
      ],
    );

    // await conn.end();
    return NextResponse.json({ success: true, customerId });
  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
