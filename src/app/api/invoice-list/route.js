import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  let conn;

  try {
    const { searchParams } = new URL(req.url);

    // Pagination
    const page = Math.max(parseInt(searchParams.get("page")) || 1, 1);
    const limit = Math.min(parseInt(searchParams.get("limit")) || 20, 100);
    const offset = (page - 1) * limit;

    // Filters
    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // Sorting (whitelisted)
    const allowedSort = ["created_at", "order_date", "invoice_number"];
    const sort = allowedSort.includes(searchParams.get("sort"))
      ? searchParams.get("sort")
      : "created_at";

    const order = searchParams.get("order") === "asc" ? "ASC" : "DESC";

    // WHERE clause builder
    let whereClause = "WHERE 1=1";
    const values = [];

    if (search) {
      whereClause += `
        AND (
          invoice_number LIKE ? OR
          buyer_name LIKE ?
        )
      `;
      values.push(`%${search}%`, `%${search}%`);
    }

    if (fromDate) {
      whereClause += " AND order_date >= ?";
      values.push(fromDate);
    }

    if (toDate) {
      whereClause += " AND order_date <= ?";
      values.push(toDate);
    }

    conn = await getDbConnection();

    // Total count
    const [[{ total }]] = await conn.execute(
      `
      SELECT COUNT(*) AS total
      FROM invoice_details
      ${whereClause}
      `,
      values,
    );

    // Paginated list data
    const [rows] = await conn.execute(
      `
      SELECT
        id,
        invoice_number,
        order_date,
        buyer_name,
        tax_amount,
        grand_total,
        created_at
      FROM invoice_details
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
  } finally {
    if (conn) conn.release?.();
  }
}
