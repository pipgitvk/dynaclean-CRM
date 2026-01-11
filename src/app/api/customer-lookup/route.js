import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// POST /api/customer-lookup
// Body: { company?: string, email?: string, phone?: string, address?: string, gstin?: string }
// Looks up customers table by multiple identifiers and returns possible matches.
export async function POST(req) {
  try {
    const body = await req.json();
    const { company, email, phone, address, gstin } = body || {};

    const conn = await getDbConnection();

    const where = [];
    const params = [];

    if (gstin && gstin.trim()) {
      where.push("gstin = ?");
      params.push(gstin.trim());
    }
    if (email && email.trim()) {
      where.push("email = ?");
      params.push(email.trim());
    }
    if (phone && String(phone).trim()) {
      where.push("phone = ?");
      params.push(String(phone).trim());
    }
    if (company && company.trim()) {
      // Match against company or contact names
      where.push("(company LIKE ? OR first_name LIKE ? OR last_name LIKE ?)");
      params.push(`%${company.trim()}%`, `%${company.trim()}%`, `%${company.trim()}%`);
    }
    if (address && address.trim()) {
      where.push("address LIKE ?");
      params.push(`%${address.trim()}%`);
    }

    if (where.length === 0) {
      return NextResponse.json({ success: true, customers: [], count: 0 });
    }

    // Build query combining all provided conditions with OR (broad search)
    const sql = `SELECT customer_id, company, first_name, last_name, address, gstin, state, email, phone
                 FROM customers
                 WHERE ${where.join(" OR ")}
                 LIMIT 10`;

    const [rows] = await conn.execute(sql, params);

    return NextResponse.json({ success: true, customers: rows || [], count: rows?.length || 0 });
  } catch (err) {
    console.error("customer-lookup error:", err);
    return NextResponse.json(
      { success: false, error: "Lookup failed" },
      { status: 500 }
    );
  }
}
