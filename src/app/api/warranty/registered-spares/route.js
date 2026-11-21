import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";

const MAX_LIMIT = 500;

export async function GET(req) {
  const token = req.cookies.get("token")?.value;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return NextResponse.json(
      { items: [], total: 0, totalPages: 0 },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );
  const search = String(searchParams.get("search") || "").trim();
  const registration = String(
    searchParams.get("registration") || "all",
  ).toLowerCase();
  const all = searchParams.get("all") === "1";
  const offset = (page - 1) * limit;

  try {
    const pool = await getDbConnection();

    const conditions = ["1=1"];
    const params = [];

    if (registration === "registered") {
      conditions.push("warranty_product_id IS NOT NULL");
    } else if (registration === "unregistered") {
      conditions.push("warranty_product_id IS NULL");
    }

    if (search) {
      const like = `%${search}%`;
      conditions.push(
        `(product_name LIKE ? OR model LIKE ? OR spare_item_code LIKE ? OR spare_item_name LIKE ? OR serial_number LIKE ? OR order_id LIKE ? OR quote_number LIKE ? OR customer_name LIKE ? OR invoice_number LIKE ? OR contact LIKE ?)`,
      );
      params.push(like, like, like, like, like, like, like, like, like, like);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const orderBy =
      "ORDER BY warranty_product_id IS NULL DESC, id DESC";

    if (all) {
      const [rows] = await pool.execute(
        `SELECT *,
          CASE WHEN warranty_product_id IS NOT NULL THEN 1 ELSE 0 END AS warranty_registered
         FROM registered_spares
         ${where}
         ${orderBy}`,
        params,
      );
      let registered = 0;
      for (const r of rows) {
        if (r.warranty_product_id != null) registered += 1;
      }
      const items = rows.map((r) => ({
        ...r,
        spare_item_code: r.spare_item_code || r.model,
        spare_item_name: r.spare_item_name || r.product_name,
        rowKey: `rs-${r.id}`,
      }));
      return NextResponse.json({
        items,
        total: items.length,
        totalPages: 1,
        currentPage: 1,
        pageSize: items.length,
        registeredCount: registered,
        notRegisteredCount: items.length - registered,
        tableTotal: items.length,
      });
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM registered_spares ${where}`,
      params,
    );
    const total = Number(countRows[0]?.total) || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const [rows] = await pool.execute(
      `SELECT *,
        CASE WHEN warranty_product_id IS NOT NULL THEN 1 ELSE 0 END AS warranty_registered
       FROM registered_spares
       ${where}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const items = rows.map((r) => ({
      ...r,
      spare_item_code: r.spare_item_code || r.model,
      spare_item_name: r.spare_item_name || r.product_name,
      rowKey: `rs-${r.id}`,
    }));

    return NextResponse.json({
      items,
      total,
      totalPages,
      currentPage: page,
      pageSize: limit,
    });
  } catch (error) {
    console.error("GET /api/warranty/registered-spares:", error);
    return NextResponse.json(
      { items: [], total: 0, totalPages: 0, error: error.message },
      { status: 500 },
    );
  }
}