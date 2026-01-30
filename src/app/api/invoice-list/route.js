import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  let conn;

  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(parseInt(searchParams.get("page")) || 1, 1);
    const limit = Math.min(parseInt(searchParams.get("limit")) || 20, 100);
    const offset = (page - 1) * limit;

    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const allowedSort = ["created_at", "invoice_date", "invoice_number"];
    const sort = allowedSort.includes(searchParams.get("sort"))
      ? searchParams.get("sort")
      : "created_at";

    const order = searchParams.get("order") === "asc" ? "ASC" : "DESC";

    // 3️⃣ Filters
    let whereClause = "WHERE 1=1";
    const values = [];

    if (search) {
      whereClause += `
        AND (
          invoice_number LIKE ?
        )
      `;
      values.push(`%${search}%`);
    }

    if (fromDate) {
      whereClause += " AND invoice_date >= ?";
      values.push(fromDate);
    }

    if (toDate) {
      whereClause += " AND invoice_date <= ?";
      values.push(toDate);
    }

    conn = await getDbConnection();

    // 4️⃣ Total count
    const [[{ total }]] = await conn.execute(
      `
      SELECT COUNT(*) AS total
      FROM invoices
      ${whereClause}
      `,
      values,
    );

    // 5️⃣ Paginated data
    const [rows] = await conn.execute(
      `
      SELECT
        id,
        quotation_id,
        invoice_number,
        invoice_date,
        due_date,
        total_amount,
        tax_amount,
        grand_total,
        status,
        created_at
      FROM invoices
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset],
    );

    return NextResponse.json({
      success: true,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: rows,
    });
  } catch (err) {
    console.error("Invoice list API error:", err);

    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 },
    );
  }
}

// for future ref for lg data

// CREATE INDEX idx_invoice_number ON invoice (invoice_number);
// CREATE INDEX idx_quotation_no ON invoice (quotation_no);
// CREATE INDEX idx_invoice_date ON invoice (invoice_date);
// CREATE INDEX idx_created_at ON invoice (created_at);
