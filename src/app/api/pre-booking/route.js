import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePreBookingRemarkColumns } from "@/lib/ensurePreBookingRemarkColumns";

// POST - Create a new pre-booking
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customer_id, product_name, item_code, quantity, expected_date } = body;

    if (!customer_id || !product_name) {
      return NextResponse.json(
        { error: "customer_id and product_name are required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    // Insert pre-booking record
    const [result] = await connection.execute(
      `INSERT INTO pre_booking (customer_id, product_name, item_code, quantity, expected_date, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customer_id, product_name, item_code || null, quantity || 1, expected_date || null, payload.username]
    );

    return NextResponse.json({
      success: true,
      message: "Pre-booking created successfully",
      id: result.insertId
    });
  } catch (error) {
    console.error("Error creating pre-booking:", error);
    return NextResponse.json(
      { error: "Failed to create pre-booking" },
      { status: 500 }
    );
  }
}

// GET - Fetch pre-bookings
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get("customer_id");
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 50;
    const offset = (page - 1) * limit;

    const connection = await getDbConnection();

    let query = "SELECT * FROM pre_booking WHERE 1=1";
    const params = [];

    if (customer_id) {
      query += " AND customer_id = ?";
      params.push(customer_id);
    }

    // Get total count
    const [countResult] = await connection.execute(
      query.replace("SELECT *", "SELECT COUNT(*) as count"),
      params
    );
    const total = countResult[0].count;

    // Get paginated results
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [bookings] = await connection.execute(query, params);

    return NextResponse.json({
      success: true,
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching pre-bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch pre-bookings" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pre-booking
export async function DELETE(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    await connection.execute(
      `DELETE FROM pre_booking WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: "Pre-booking deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting pre-booking:", error);
    return NextResponse.json(
      { error: "Failed to delete pre-booking" },
      { status: 500 }
    );
  }
}

// PATCH - Update customer_id OR add remark (order cancelled / order postponed)
export async function PATCH(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      customer_id,
      item_code,
      quantity,
      status,
      order_id,
      received_date,
      remark_type,
      remark_reason,
      postponed_date,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const isRemarkOnlyUpdate =
      remark_type &&
      remark_reason !== undefined &&
      customer_id === undefined &&
      item_code === undefined &&
      quantity === undefined &&
      status === undefined &&
      order_id === undefined &&
      received_date === undefined;

    const isEditUpdate =
      !isRemarkOnlyUpdate &&
      (customer_id !== undefined ||
        item_code !== undefined ||
        quantity !== undefined ||
        status !== undefined ||
        order_id !== undefined ||
        received_date !== undefined ||
        remark_type !== undefined ||
        remark_reason !== undefined ||
        postponed_date !== undefined);

    if (isEditUpdate) {
      const connection = await getDbConnection();
      await ensurePreBookingRemarkColumns(connection);
      const updates = [];
      const params = [];

      if (customer_id !== undefined) {
        const normalizedCustomerId = String(customer_id || "").trim();
        if (!normalizedCustomerId) {
          return NextResponse.json(
            { error: "customer_id is required" },
            { status: 400 },
          );
        }

        const [customers] = await connection.execute(
          "SELECT customer_id FROM customers WHERE customer_id = ? LIMIT 1",
          [normalizedCustomerId],
        );

        if (!customers.length) {
          return NextResponse.json(
            { error: "Customer not found" },
            { status: 404 },
          );
        }

        updates.push("customer_id = ?");
        params.push(normalizedCustomerId);
      }

      if (item_code !== undefined) {
        const normalizedItemCode = String(item_code || "").trim();
        updates.push("item_code = ?");
        params.push(normalizedItemCode || null);

        if (normalizedItemCode) {
          const [products] = await connection.execute(
            `SELECT item_name FROM products_list WHERE item_code = ? LIMIT 1`,
            [normalizedItemCode],
          );
          if (products.length) {
            updates.push("product_name = ?");
            params.push(products[0].item_name);
          }
        }
      }

      if (quantity !== undefined) {
        const parsedQty = parseInt(quantity, 10);
        if (!Number.isFinite(parsedQty) || parsedQty < 1) {
          return NextResponse.json(
            { error: "quantity must be at least 1" },
            { status: 400 },
          );
        }

        updates.push("quantity = ?");
        params.push(parsedQty);
      }

      if (status !== undefined) {
        const normalizedStatus = String(status || "").trim().toLowerCase();
        const allowedStatuses = [
          "pending",
          "partial",
          "received",
          "cancelled",
          "postponed",
        ];

        if (!allowedStatuses.includes(normalizedStatus)) {
          return NextResponse.json(
            { error: "Invalid status value" },
            { status: 400 },
          );
        }

        updates.push("status = ?");
        params.push(normalizedStatus);
      }

      if (order_id !== undefined) {
        const normalizedOrderId = String(order_id || "").trim();
        updates.push("order_id = ?");
        params.push(normalizedOrderId || null);
      }

      if (received_date !== undefined) {
        const normalizedReceivedDate = String(received_date || "").trim();
        updates.push("received_date = ?");
        params.push(normalizedReceivedDate || null);
      }

      if (
        remark_type !== undefined ||
        remark_reason !== undefined ||
        postponed_date !== undefined
      ) {
        const normalizedRemarkType = String(remark_type || "")
          .trim()
          .toLowerCase();

        if (!normalizedRemarkType) {
          updates.push("remark_type = NULL");
          updates.push("remark_reason = NULL");
          updates.push("postponed_date = NULL");
        } else if (normalizedRemarkType === "cancelled") {
          if (!remark_reason?.trim()) {
            return NextResponse.json(
              { error: "remark_reason is required for cancelled remark" },
              { status: 400 },
            );
          }

          updates.push("remark_type = ?");
          params.push("cancelled");
          updates.push("remark_reason = ?");
          params.push(remark_reason.trim());
          updates.push("postponed_date = NULL");
        } else if (normalizedRemarkType === "postponed") {
          if (!remark_reason?.trim()) {
            return NextResponse.json(
              { error: "remark_reason is required for postponed remark" },
              { status: 400 },
            );
          }

          if (!postponed_date) {
            return NextResponse.json(
              { error: "postponed_date is required for postponed remark" },
              { status: 400 },
            );
          }

          updates.push("remark_type = ?");
          params.push("postponed");
          updates.push("remark_reason = ?");
          params.push(remark_reason.trim());
          updates.push("postponed_date = ?");
          params.push(postponed_date);
        } else {
          return NextResponse.json(
            { error: "Invalid remark_type. Must be 'cancelled' or 'postponed'" },
            { status: 400 },
          );
        }
      }

      if (!updates.length) {
        return NextResponse.json(
          { error: "No fields to update" },
          { status: 400 },
        );
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      params.push(id);

      await connection.execute(
        `UPDATE pre_booking SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );

      const [rows] = await connection.execute(
        `SELECT
          pb.*,
          c.first_name,
          c.last_name,
          c.lead_source,
          c.company,
          c.phone,
          c.email
         FROM pre_booking pb
         LEFT JOIN customers c ON pb.customer_id = c.customer_id
         WHERE pb.id = ?
         LIMIT 1`,
        [id],
      );

      return NextResponse.json({
        success: true,
        message: "Pre-booking updated successfully",
        booking: rows[0] || null,
      });
    }

    if (!remark_type) {
      return NextResponse.json(
        {
          error:
            "remark_type or at least one editable field is required",
        },
        { status: 400 },
      );
    }

    if (!["cancelled", "postponed"].includes(remark_type)) {
      return NextResponse.json(
        { error: "Invalid remark_type. Must be 'cancelled' or 'postponed'" },
        { status: 400 },
      );
    }

    if (!remark_reason?.trim()) {
      return NextResponse.json(
        { error: "remark_reason is required" },
        { status: 400 },
      );
    }

    if (remark_type === "postponed" && !postponed_date) {
      return NextResponse.json(
        { error: "postponed_date is required for postponed orders" },
        { status: 400 },
      );
    }

    const connection = await getDbConnection();
    await ensurePreBookingRemarkColumns(connection);

    if (remark_type === "cancelled") {
      await connection.execute(
        `UPDATE pre_booking
         SET status = 'cancelled',
             remark_type = 'cancelled',
             remark_reason = ?,
             postponed_date = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [remark_reason.trim(), id],
      );
    } else {
      await connection.execute(
        `UPDATE pre_booking
         SET status = 'postponed',
             remark_type = 'postponed',
             remark_reason = ?,
             postponed_date = ?,
             expected_date = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [remark_reason.trim(), postponed_date, postponed_date, id],
      );
    }

    return NextResponse.json({
      success: true,
      message: "Remark saved successfully",
    });
  } catch (error) {
    console.error("Error saving pre-booking remark:", error);
    return NextResponse.json(
      { error: "Failed to save remark" },
      { status: 500 },
    );
  }
}

// PUT - Update pre-booking status
export async function PUT(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!['pending', 'received'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'pending' or 'received'" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    await connection.execute(
      `UPDATE pre_booking SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );

    return NextResponse.json({
      success: true,
      message: "Pre-booking status updated successfully"
    });
  } catch (error) {
    console.error("Error updating pre-booking status:", error);
    return NextResponse.json(
      { error: "Failed to update pre-booking status" },
      { status: 500 }
    );
  }
}
