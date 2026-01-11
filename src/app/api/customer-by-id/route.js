import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function POST(req) {
  try {
    const { customer_id } = await req.json();

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

    if (!customer_id || customer_id.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();

    let query, params;

    // If SUPERADMIN, ADMIN, or SERVICE HEAD can access all customers
    if (role === "SUPERADMIN" || role === "ADMIN" || role === "SERVICE HEAD") {
      query = `
        SELECT customer_id, company, first_name, last_name, address, gstin, state, lead_source
        FROM customers
        WHERE customer_id = ?
        LIMIT 1
      `;
      params = [customer_id];
    } else {
      // Regular users can only access their own customers
      query = `
        SELECT customer_id, company, first_name, last_name, address, gstin, state, lead_source
        FROM customers
        WHERE customer_id = ? AND lead_source = ?
        LIMIT 1
      `;
      params = [customer_id, username];
    }

    const [rows] = await pool.execute(query, params);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Customer not found or you don't have access" },
        { status: 404 }
      );
    }

    const customer = rows[0];

    return NextResponse.json({
      success: true,
      customer: {
        customer_id: customer.customer_id,
        company: customer.company || "",
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        location: customer.address || "",
        gstin: customer.gstin || "",
        state: customer.state || "",
        lead_source: customer.lead_source || "",
      },
    });
  } catch (error) {
    console.error("❌ Error fetching customer:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}
