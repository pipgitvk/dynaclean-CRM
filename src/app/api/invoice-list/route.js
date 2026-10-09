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
          i.invoice_number LIKE ? OR
          i.customer_name LIKE ? OR
          i.gst_number LIKE ? OR
          i.employee_name LIKE ? OR
          ii.item_code LIKE ? OR
          ii.item_name LIKE ? OR
          ii.hsn_code LIKE ?
        )
      `;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (fromDate) {
      whereClause += " AND COALESCE(order_date, invoice_date) >= ?";
      values.push(fromDate);
    }

    if (toDate) {
      whereClause += " AND COALESCE(order_date, invoice_date) <= ?";
      values.push(toDate);
    }

    conn = await getDbConnection();

    // Total count with LEFT JOIN for search
    const [[{ total }]] = await conn.execute(
      `
      SELECT COUNT(DISTINCT i.id) AS total
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereClause}
      `,
      values,
    );

    // Paginated list data with LEFT JOIN
    const [rows] = await conn.execute(
      `
      SELECT DISTINCT
        i.id,
        i.invoice_number,
        COALESCE(i.order_date, i.invoice_date) AS order_date,
        i.customer_name as buyer_name,
        i.gst_number,
        i.employee_name,
        COALESCE(i.cgst, 0) + COALESCE(i.sgst, 0) + COALESCE(i.igst, 0) AS tax_amount,
        COALESCE(i.cgst, 0) AS cgst,
        COALESCE(i.sgst, 0) AS sgst,
        COALESCE(i.igst, 0) AS igst,
        i.grand_total,
        i.created_at
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset],
    );

    // Fetch items for each invoice
    const invoicesWithItems = await Promise.all(
      rows.map(async (invoice) => {
        const [items] = await conn.execute(
          `SELECT 
            item_code, 
            item_name, 
            quantity, 
            hsn_code, 
            taxable_value, 
            cgst_amount, 
            sgst_amount, 
            igst_amount,
            rate as price_per_unit
          FROM invoice_items 
          WHERE invoice_id = ?`,
          [invoice.id]
        );
        return {
          ...invoice,
          items: items || []
        };
      })
    );

    return NextResponse.json({
      success: true,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: invoicesWithItems,
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
