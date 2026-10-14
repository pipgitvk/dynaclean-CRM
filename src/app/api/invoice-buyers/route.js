import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const BASE_WHERE = `
  i.customer_name IS NOT NULL
  AND TRIM(i.customer_name) != ''
  AND i.customer_id IS NOT NULL
`;

const GROUP_BY = `GROUP BY i.customer_id, TRIM(i.customer_name)`;

// GET /api/invoice-buyers?page=1&limit=20&search=
export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page"), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit"), 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const search = (searchParams.get("search") || "").trim();

    let searchSql = "";
    const searchValues = [];
    if (search) {
      searchSql = " AND TRIM(i.customer_name) LIKE ? ";
      searchValues.push(`%${search}%`);
    }

    const conn = await getDbConnection();

    const [[summaryRow]] = await conn.execute(
      `
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(SUM(i.grand_total), 0) AS total_amount,
        COALESCE(SUM(COALESCE(i.cgst, 0) + COALESCE(i.sgst, 0) + COALESCE(i.igst, 0)), 0) AS total_tax
      FROM invoices i
      WHERE ${BASE_WHERE}
      ${searchSql}
      `,
      searchValues,
    );

    const [[{ buyer_count }]] = await conn.execute(
      `
      SELECT COUNT(*) AS buyer_count
      FROM (
        SELECT 1
        FROM invoices i
        WHERE ${BASE_WHERE}
        ${searchSql}
        ${GROUP_BY}
      ) grouped_buyers
      `,
      searchValues,
    );

    const totalBuyers = Number(buyer_count) || 0;
    const totalPages = Math.max(1, Math.ceil(totalBuyers / limit));

    const [rows] = await conn.execute(
      `
      SELECT
        i.customer_id,
        TRIM(i.customer_name) AS buyer_name,
        COUNT(*) AS invoice_count,
        SUM(i.grand_total) AS total_amount,
        SUM(COALESCE(i.cgst, 0) + COALESCE(i.sgst, 0) + COALESCE(i.igst, 0)) AS total_tax,
        MAX(COALESCE(i.order_date, i.invoice_date)) AS last_invoice_date,
        MIN(COALESCE(i.order_date, i.invoice_date)) AS first_invoice_date
      FROM invoices i
      WHERE ${BASE_WHERE}
      ${searchSql}
      ${GROUP_BY}
      ORDER BY total_amount DESC
      LIMIT ? OFFSET ?
      `,
      [...searchValues, limit, offset],
    );

    return NextResponse.json({
      success: true,
      buyers: rows,
      summary: {
        buyers: totalBuyers,
        invoices: Number(summaryRow?.invoice_count) || 0,
        amount: Number(summaryRow?.total_amount) || 0,
        tax: Number(summaryRow?.total_tax) || 0,
      },
      meta: {
        page,
        limit,
        total: totalBuyers,
        totalPages,
      },
    });
  } catch (err) {
    console.error("[invoice-buyers GET]", err?.message);
    return NextResponse.json({ error: "DB error", detail: err?.message }, { status: 500 });
  }
}
