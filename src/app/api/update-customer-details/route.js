import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function POST(req) {
  try {
    const { customer_id, company, gstin } = await req.json();

    // Extract username from JWT in cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value || cookieStore.get("impersonation_token")?.value;
    let username = "Unknown";
    let role = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        username = decoded.username || "Unknown";
        role = decoded.role;
      } catch (error) {
        console.error("JWT decode failed", error);
        return NextResponse.json(
          { success: false, error: "Invalid token" },
          { status: 401 }
        );
      }
    }

    if (!customer_id) {
      return NextResponse.json(
        { success: false, error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();

    // Build update query based on what needs to be updated
    let updateFields = [];
    let params = [];

    if (company && company.trim()) {
      updateFields.push("company = ?");
      params.push(company.trim());
    }

    if (gstin && gstin.trim()) {
      updateFields.push("gstin = ?");
      params.push(gstin.trim());
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    // Add customer_id to params
    params.push(customer_id);

    // Add lead_source check for non-admin users
    let whereClause = "customer_id = ?";
    if (role !== "SUPERADMIN" && role !== "ADMIN" && role !== "SERVICE HEAD") {
      whereClause += " AND lead_source = ?";
      params.push(username);
    }

    const query = `
      UPDATE customers
      SET ${updateFields.join(", ")}
      WHERE ${whereClause}
    `;

    const [result] = await pool.execute(query, params);

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Customer not found or no permission to update" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer details updated successfully",
    });
  } catch (error) {
    console.error("❌ Error updating customer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update customer" },
      { status: 500 }
    );
  }
}
