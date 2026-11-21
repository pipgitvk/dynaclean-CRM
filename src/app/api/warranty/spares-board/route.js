import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";
import { ensureRegisteredSparesTable } from "@/lib/ensureRegisteredSparesTable";
import { syncPendingSparesToRegisteredSpares } from "@/lib/syncPendingSparesToRegisteredSpares";
import {
  buildSpareBoardListSql,
  buildSpareBoardRegistrationClause,
  buildSpareBoardSearchClause,
  buildSpareBoardStatsSql,
} from "@/lib/registeredSparesBoardQuery";

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
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );
  const search = String(searchParams.get("search") || "").trim();
  const registration = String(
    searchParams.get("registration") || "all",
  ).toLowerCase();
  const offset = (page - 1) * limit;
  const includeOrphans = registration !== "unregistered";
  const innerSql = buildSpareBoardListSql({ includeOrphans });

  const filters = [buildSpareBoardRegistrationClause(registration)];
  const filterParams = [];
  const { sql: searchSql, params: searchParamsSql } =
    buildSpareBoardSearchClause(search);
  if (searchSql) {
    filters.push(searchSql);
    filterParams.push(...searchParamsSql);
  }
  const whereOuter = `WHERE ${filters.join(" AND ")}`;

  try {
    const pool = await getDbConnection();
    await ensureRegisteredSparesTable(pool);
    try {
      await syncPendingSparesToRegisteredSpares(pool);
    } catch (syncErr) {
      console.error("sync pending spares:", syncErr?.message || syncErr);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM (${innerSql}) board ${whereOuter}`,
      filterParams,
    );
    const total = Number(countRows[0]?.total) || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    let stats = {};
    const wantStats =
      page === 1 && !search && (registration === "all" || registration === "");
    if (wantStats) {
      const [statsRows] = await pool.execute(buildSpareBoardStatsSql(), []);
      stats = statsRows[0] || {};
    }

    const [rows] = await pool.execute(
      `SELECT * FROM (${innerSql}) board
       ${whereOuter}
       ORDER BY warranty_registered ASC, order_id DESC, spare_item_code ASC
       LIMIT ? OFFSET ?`,
      [...filterParams, limit, offset],
    );

    return NextResponse.json({
      items: rows,
      total,
      totalPages,
      currentPage: page,
      pageSize: limit,
      registeredCount: Number(stats.registered) || 0,
      notRegisteredCount: Number(stats.not_registered) || 0,
      pipelineTotal: Number(stats.total) || 0,
    });
  } catch (error) {
    console.error("GET /api/warranty/spares-board:", error);
    return NextResponse.json(
      {
        items: [],
        total: 0,
        totalPages: 0,
        error: error.message,
      },
      { status: 500 },
    );
  }
}