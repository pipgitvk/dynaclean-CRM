import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    console.log("👉 [DEBUG] Starting Special Price POST request.");

    // ✅ 1. Authenticate user
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = payload;

    // ✅ 2. Parse body
    const body = await req.json();
    const { customer_id, product_id, product_code, price } = body;

    console.log("👉 [DEBUG] Received body:", body);

    // ✅ 3. Validate input
    if (!customer_id || !product_id || !product_code) {
      return NextResponse.json(
        { error: "customer_id, product_id and product_code are required" },
        { status: 400 }
      );
    }

    if (price === undefined || price === null || Number.isNaN(Number(price))) {
      return NextResponse.json(
        { error: "Invalid price value" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // ✅ 4. Prevent duplicate special price for non-approved rows
    const [existing] = await conn.execute(
      `SELECT id, status FROM special_price 
       WHERE customer_id = ? AND product_id = ?`,
      [customer_id, product_id]
    );

    if (existing.length > 0) {
      const hasNonApproved = existing.some(
        (row) => (row.status || "").toLowerCase() !== "approved",
      );

      if (hasNonApproved) {
        // If there is already a draft/pending/rejected entry for this
        // customer+product, do NOT create another one. Return a
        // successful no-op so the multi-select UX is smooth.
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          message:
            "Special price already exists in non-approved state; existing record kept as-is.",
        });
      }
      // If all existing records are approved, allow inserting a new
      // draft special price (user might be requesting a new change).
    }

    // ✅ 5. Initial status: draft (user can edit; approval happens after edit)
    const status = "draft";

    // ✅ 6. Insert special price (handle unique constraint gracefully)
    const insertQuery = `
      INSERT INTO special_price 
      (customer_id, product_id, product_code, special_price, status, set_by, set_date)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const insertParams = [
      customer_id,
      product_id,
      product_code,
      Number(price),
      status,
      username,
    ];

    try {
      await conn.execute(insertQuery, insertParams);
    } catch (e) {
      // If the DB unique key still blocks this insert (race condition or
      // schema differences), treat it as a no-op success instead of 500.
      if (e && e.code === "ER_DUP_ENTRY") {
        console.warn(
          "⚠️ Duplicate special_price row blocked by unique constraint; returning graceful success.",
        );
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          message:
            "Special price already exists for this customer and product; existing record kept as-is.",
        });
      }
      throw e;
    }

    console.log("✅ Special price created by:", username);

    return NextResponse.json({
      success: true,
      message: "Special price created. You can edit it from the Customer Special Prices table to send for approval.",
    });

  } catch (err) {
    console.error("❌ Special price creation failed:", err);

    return NextResponse.json(
      { error: "Special price creation failed" },
      { status: 500 }
    );
  }
}




export async function DELETE(req) {
  try {
    console.log("👉 [DEBUG] Starting Special Price DELETE request.");

    // ✅ 1. Authenticate user
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role } = payload;

    // ✅ 2. Allow only ADMIN (Recommended)
    if (role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only admin can delete special price" },
        { status: 403 }
      );
    }

    // ✅ 3. Get query params
    const { searchParams } = new URL(req.url);
    const customer_id = searchParams.get("customer_id");
    const product_id = searchParams.get("product_id");

    if (!customer_id || !product_id) {
      return NextResponse.json(
        { error: "customer_id and product_id are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // ✅ 4. Check if record exists
    const [existing] = await conn.execute(
      `SELECT id FROM special_price 
       WHERE customer_id = ? AND product_id = ?`,
      [customer_id, product_id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Special price not found" },
        { status: 404 }
      );
    }

    // ✅ 5. Delete record
    await conn.execute(
      `DELETE FROM special_price 
       WHERE customer_id = ? AND product_id = ?`,
      [customer_id, product_id]
    );

    console.log("✅ Special price deleted");

    return NextResponse.json({
      success: true,
      message: "Special price deleted successfully",
    });

  } catch (err) {
    console.error("❌ Special price deletion failed:", err);

    return NextResponse.json(
      { error: "Special price deletion failed" },
      { status: 500 }
    );
  }
}
