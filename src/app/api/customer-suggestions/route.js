import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function POST(req) {
  const { query } = await req.json();

  // ✅ Extract username and role from JWT in cookies
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let username = "Unknown";
  let role = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      username = decoded.username || "Unknown";
      role = decoded.role;
    } catch (error) {
      console.error("JWT decode failed", error);
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }
  }


  if (!query || query.trim() === "") {
    return NextResponse.json([]);
  }

  try {
    const conn = await getDbConnection();

    let rows;

    // Check if user can access all customers
    const canAccessAll = role === "SUPERADMIN" || role === "ADMIN" || role === "SERVICE HEAD";

    if (/^\d+$/.test(query.trim())) {
      // Pure numeric input → likely customer ID
      if (canAccessAll) {
        [rows] = await conn.execute(
          `SELECT customer_id, company, address AS location, gstin, state
           FROM customers
           WHERE customer_id = ?
           LIMIT 1`,
          [query.trim()]
        );
      } else {
        [rows] = await conn.execute(
          `SELECT customer_id, company, address AS location, gstin, state
           FROM customers
           WHERE customer_id = ? AND lead_source = ?
           LIMIT 1`,
          [query.trim(), username]
        );
      }
    } else {
      // Partial search by company/gstin/state/etc
      const searchTerm = `%${query.trim()}%`;
      
      if (canAccessAll) {
        [rows] = await conn.execute(
          `SELECT customer_id, company, address AS location, gstin, state
           FROM customers
           WHERE (company LIKE ? OR first_name LIKE ? OR address LIKE ? OR gstin LIKE ? OR state LIKE ?)
           LIMIT 10`,
          [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
        );
      } else {
        [rows] = await conn.execute(
          `SELECT customer_id, company, address AS location, gstin, state
           FROM customers
           WHERE (company LIKE ? OR first_name LIKE ? OR address LIKE ? OR gstin LIKE ? OR state LIKE ?)
             AND lead_source = ?
           LIMIT 10`,
          [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, username]
        );
      }
    }

    const companies = rows.map((row) => ({
      customer_id: row.customer_id,
      company: row.company,
      location: row.location ?? "",
      gstin: row.gstin ?? "",
      state: row.state ?? "",
    }));

    return NextResponse.json(companies);
  } catch (err) {
    console.error("❌ MySQL error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
