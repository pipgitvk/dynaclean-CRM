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

    const { username, role } = payload;

    // ✅ 2. Parse body
    const body = await req.json();
    const { customer_id, product_id,product_code, price } = body;

    console.log("👉 [DEBUG] Received body:", body);

    // ✅ 3. Validate input
    if (!customer_id || !product_id || !product_code || !price) {
      return NextResponse.json(
        { error: "customer_id, product_id, product_code and price are required" },
        { status: 400 }
      );
    }

    if (isNaN(price) || Number(price) <= 0) {
      return NextResponse.json(
        { error: "Invalid price value" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // ✅ 4. Prevent duplicate special price
    const [existing] = await conn.execute(
      `SELECT id FROM special_price 
       WHERE customer_id = ? AND product_id = ?`,
      [customer_id, product_id]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Special price already exists for this customer & product" },
        { status: 400 }
      );
    }

    // ✅ 5. Insert special price
    const insertQuery = `
      INSERT INTO special_price 
      (customer_id, product_id,product_code, special_price, status, set_by, set_date)
      VALUES (?, ?,?, ?, ?, ?, NOW())
    `;

    const insertParams = [
      customer_id,
      product_id,
      product_code,
      Number(price),
      role === "ADMIN" ? "APPROVED" : "PENDING",
      username, // 🔥 Backend controls set_by
    ];

    await conn.execute(insertQuery, insertParams);

    console.log("✅ Special price created by:", username);

    return NextResponse.json({
      success: true,
      message: "Special price created successfully",
    });

  } catch (err) {
    console.error("❌ Special price creation failed:", err);

    return NextResponse.json(
      { error: "Special price creation failed" },
      { status: 500 }
    );
  }
}
