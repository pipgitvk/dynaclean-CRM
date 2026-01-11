import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { convertISTtoUTC } from "@/lib/timezone";

// GET - Fetch TL follow-ups
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id");
    const tlUsername = searchParams.get("tl_username");

    const connection = await getDbConnection();
    let query = `
      SELECT 
        tlf.*,
        c.first_name,
        c.last_name,
        c.company,
        c.phone,
        c.email,
        c.status as customer_status,
        c.products_interest,
        c.lead_source,
        c.assigned_to
      FROM TL_followups tlf
      INNER JOIN customers c ON tlf.customer_id = c.customer_id
    `;
    const params = [];

    const conditions = [];
    if (customerId) {
      conditions.push("tlf.customer_id = ?");
      params.push(customerId);
    }
    if (tlUsername) {
      conditions.push("tlf.followed_by = ?");
      params.push(tlUsername);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY tlf.created_at DESC";

    const [followups] = await connection.execute(query, params);

    return NextResponse.json({ success: true, followups });
  } catch (error) {
    console.error("Error fetching TL follow-ups:", error);
    return NextResponse.json(
      { error: "Failed to fetch TL follow-ups" },
      { status: 500 }
    );
  }
}

// POST - Create new TL follow-up
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customer_id,
      estimated_order_date,
      lead_quality_score,
      multi_tag,
      status,
      notes,
      followed_date,
      next_followup_date,
      assigned_employee,
      stage
    } = body;

    if (!customer_id || !followed_date) {
      return NextResponse.json(
        { error: "customer_id and followed_date are required" },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();
    const connection = await pool.getConnection();
    const followed_by = payload.username;

    // Convert IST datetime to UTC before storing
    const followedDateUTC = convertISTtoUTC(followed_date);
    const nextFollowupDateUTC = convertISTtoUTC(next_followup_date);
    const estimatedOrderDateUTC = convertISTtoUTC(estimated_order_date);

    if (!followedDateUTC) {
      return NextResponse.json(
        { error: "Invalid followed_date format. Use YYYY-MM-DDTHH:mm" },
        { status: 400 }
      );
    }

    // Start transaction to update both tables
    await connection.beginTransaction();

    try {
      // Insert into TL_followups table (no status/stage columns in this table)
      const [result] = await connection.execute(
        `INSERT INTO TL_followups
         (customer_id, estimated_order_date, lead_quality_score, multi_tag, notes, followed_date, next_followup_date, followed_by, assigned_employee)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer_id,
          estimatedOrderDateUTC || null,
          lead_quality_score || null,
          multi_tag || null,
          notes || null,
          followedDateUTC,
          nextFollowupDateUTC || null,
          followed_by,
          assigned_employee || null
        ]
      );

      // Update customers table with status and stage (these columns exist only in customers)
      await connection.execute(
        `UPDATE customers SET status = ?, stage = ? WHERE customer_id = ?`,
        [(status ?? null), (stage ?? null), customer_id]
      );

      // Commit transaction
      await connection.commit();

      return NextResponse.json({
        success: true,
        message: "TL follow-up added successfully",
        id: result.insertId
      });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection back to pool
      connection.release();
    }
  } catch (error) {
    console.error("Error creating TL follow-up:", error);
    return NextResponse.json(
      { error: "Failed to create TL follow-up" },
      { status: 500 }
    );
  }
}

// PUT - Update TL follow-up
export async function PUT(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      id,
      estimated_order_date,
      lead_quality_score,
      multi_tag,
      notes,
      followed_date,
      next_followup_date,
      assigned_employee
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const pool = await getDbConnection();
    const connection = await pool.getConnection();

    // Convert IST datetime to UTC before storing
    const followedDateUTC = convertISTtoUTC(followed_date);
    const nextFollowupDateUTC = convertISTtoUTC(next_followup_date);
    const estimatedOrderDateUTC = convertISTtoUTC(estimated_order_date);

    try {
      await connection.execute(
        `UPDATE TL_followups
         SET estimated_order_date = ?, lead_quality_score = ?, multi_tag = ?, notes = ?, followed_date = ?, next_followup_date = ?, assigned_employee = ?
         WHERE id = ?`,
        [
          estimatedOrderDateUTC || null,
          lead_quality_score || null,
          multi_tag || null,
          notes || null,
          followedDateUTC || null,
          nextFollowupDateUTC || null,
          assigned_employee || null,
          id
        ]
      );

      return NextResponse.json({
        success: true,
        message: "TL follow-up updated successfully"
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error updating TL follow-up:", error);
    return NextResponse.json(
      { error: "Failed to update TL follow-up" },
      { status: 500 }
    );
  }
}

// DELETE - Remove TL follow-up
export async function DELETE(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const pool = await getDbConnection();
    const connection = await pool.getConnection();

    try {
      await connection.execute(`DELETE FROM TL_followups WHERE id = ?`, [id]);

      return NextResponse.json({
        success: true,
        message: "TL follow-up deleted successfully"
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error deleting TL follow-up:", error);
    return NextResponse.json(
      { error: "Failed to delete TL follow-up" },
      { status: 500 }
    );
  }
}
