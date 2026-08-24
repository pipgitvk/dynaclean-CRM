import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getScopedUsername } from "@/lib/dataScope";
import { buildCustomerOwnershipWhere } from "@/lib/scheduleVisitScope";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit")) || 10;
    const scopeOwn = searchParams.get("scope") === "own";

    const conn = await getDbConnection();
    const username = getScopedUsername(payload);

    let sql = `
      SELECT 
        customer_id,
        CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as customer_name,
        first_name,
        last_name,
        phone,
        email,
        address,
        company,
        state
      FROM customers 
      WHERE 1=1
    `;

    const params = [];

    if (scopeOwn) {
      const ownership = buildCustomerOwnershipWhere({
        role: payload.role,
        username,
      });
      if (ownership.whereClause) {
        sql += ` ${ownership.whereClause}`;
        params.push(...ownership.params);
      }
    }

    if (query.trim()) {
      sql += ` AND (
        CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) LIKE ? OR 
        first_name LIKE ? OR
        last_name LIKE ? OR
        company LIKE ? OR
        phone LIKE ? OR 
        email LIKE ? OR
        customer_id LIKE ?
      )`;
      const searchTerm = `%${query.trim()}%`;
      params.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm
      );
      sql += ` ORDER BY first_name ASC LIMIT ?`;
    } else {
      sql += ` ORDER BY date_created DESC LIMIT ?`;
    }
    params.push(limit);

    const [rows] = await conn.execute(sql, params);

    return NextResponse.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Error searching customers:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
