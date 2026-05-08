import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET;

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const conn = await getDbConnection();

    // Fetch delivery challan
    const [challanRows] = await conn.execute(
      "SELECT * FROM delivery_challans WHERE id = ?",
      [id]
    );

    if (challanRows.length === 0) {
      return NextResponse.json({ error: "Delivery challan not found" }, { status: 404 });
    }

    const challan = challanRows[0];

    // Fetch items
    const [itemRows] = await conn.execute(
      "SELECT * FROM delivery_challan_items WHERE delivery_challan_id = ?",
      [id]
    );

    challan.items = itemRows;

    return NextResponse.json({ success: true, data: challan });
  } catch (error) {
    console.error("Error fetching delivery challan:", error);
    return NextResponse.json(
      { error: "Failed to fetch delivery challan" },
      { status: 500 }
    );
  }
}
