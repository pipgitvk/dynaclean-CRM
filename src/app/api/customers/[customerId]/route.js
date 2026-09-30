import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(request, { params }) {
  const { customerId } = await params;

  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT c.*,
        IF(EXISTS (
          SELECT 1 FROM neworder no
          INNER JOIN quotations_records qr ON no.quote_number = qr.quote_number
          WHERE qr.customer_id = c.customer_id
        ), 1, 0) AS has_order
       FROM customers c
       WHERE c.customer_id = ?
       LIMIT 1`,
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
  const { lead_source, service_lead_source, gem_lead_source } = await request.json();

  const payload = await getSessionPayload();
  const userRole = payload?.role;
  const isServiceUser = userRole === "SERVICE SUPPORT" || userRole === "SERVICE HEAD";
  const isSuperAdminOrEA = userRole === "SUPERADMIN" || userRole === "EA";

  // Basic validation
  if (!isServiceUser && !isSuperAdminOrEA && !lead_source) {
    return NextResponse.json({ error: "Lead source is required." }, { status: 400 });
  }

  try {
    const conn = await getDbConnection();

    // Check if optional columns exist
    let serviceLeadSourceColumn = false;
    let gemLeadSourceColumn = false;
    try {
      const [columns1] = await conn.execute("SHOW COLUMNS FROM customers LIKE 'service_lead_source'");
      serviceLeadSourceColumn = columns1.length > 0;
      const [columns2] = await conn.execute("SHOW COLUMNS FROM customers LIKE 'gem_lead_source'");
      gemLeadSourceColumn = columns2.length > 0;
    } catch (e) {}

    // Get current data to preserve fields not being updated
    let selectQuery = `SELECT lead_source, service_lead_source`;
    if (gemLeadSourceColumn) selectQuery += `, gem_lead_source`;
    selectQuery += ` FROM customers WHERE customer_id = ?`;
    const [currentRows] = await conn.execute(selectQuery, [customerId]);
    const currentData = currentRows[0] || {};

    let result;

    if (isSuperAdminOrEA) {
      // SUPERADMIN / EA: update lead_source + service_lead_source + gem_lead_source all at once
      const newLeadSource = lead_source !== undefined ? lead_source : currentData.lead_source;
      const newServiceLeadSource = service_lead_source !== undefined
        ? (service_lead_source === '' ? null : service_lead_source)
        : currentData.service_lead_source;
      const newGemLeadSource = gem_lead_source !== undefined
        ? (gem_lead_source === '' ? null : gem_lead_source)
        : (gemLeadSourceColumn ? currentData.gem_lead_source : null);

      if (gemLeadSourceColumn) {
        [result] = await conn.execute(
          `UPDATE customers SET lead_source = ?, sales_representative = ?, service_lead_source = ?, gem_lead_source = ? WHERE customer_id = ?`,
          [newLeadSource, newLeadSource, newServiceLeadSource, newGemLeadSource, customerId]
        );
      } else {
        [result] = await conn.execute(
          `UPDATE customers SET lead_source = ?, sales_representative = ?, service_lead_source = ? WHERE customer_id = ?`,
          [newLeadSource, newLeadSource, newServiceLeadSource, customerId]
        );
      }
    } else if (isServiceUser) {
      // SERVICE SUPPORT / SERVICE HEAD: only update service_lead_source
      if (serviceLeadSourceColumn) {
        const newServiceLeadSource = service_lead_source !== undefined ? service_lead_source : currentData.service_lead_source;
        [result] = await conn.execute(
          `UPDATE customers SET service_lead_source = ? WHERE customer_id = ?`,
          [newServiceLeadSource === '' ? null : newServiceLeadSource, customerId]
        );
      } else {
        return NextResponse.json({ message: "Service lead source column not available yet." }, { status: 200 });
      }
    } else {
      // Other roles: update lead_source + service_lead_source
      if (serviceLeadSourceColumn) {
        const newServiceLeadSource = service_lead_source !== undefined ? service_lead_source : currentData.service_lead_source;
        [result] = await conn.execute(
          `UPDATE customers SET lead_source = ?, sales_representative = ?, service_lead_source = ? WHERE customer_id = ?`,
          [lead_source, lead_source, newServiceLeadSource === '' ? null : newServiceLeadSource, customerId]
        );
      } else {
        [result] = await conn.execute(
          `UPDATE customers SET lead_source = ?, sales_representative = ? WHERE customer_id = ?`,
          [lead_source, lead_source, customerId]
        );
      }
    }
    // await conn.end();

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "No customer found with the provided ID or no change was made." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Customer updated successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json(
      { error: "Failed to update customer." },
      { status: 500 }
    );
  }
}