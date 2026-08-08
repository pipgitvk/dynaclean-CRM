import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

async function ensureTable(conn) {
  try {
    await conn.execute("SELECT id FROM bank_masters LIMIT 1");
  } catch (_) {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS bank_masters (
        id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
        bank_name           VARCHAR(150) NOT NULL,
        ifsc                VARCHAR(20)  NULL,
        account_number      VARCHAR(50)  NULL,
        branch_address      TEXT         NULL,
        account_holder_name VARCHAR(200) NULL,
        created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const conn = await getDbConnection();
    await ensureTable(conn);

    const [rows] = await conn.execute(
      "SELECT id, bank_name, ifsc, account_number, branch_address, account_holder_name, created_at FROM bank_masters ORDER BY bank_name ASC"
    );
    return NextResponse.json({ banks: rows });
  } catch (err) {
    console.error("[bank-masters] GET error:", err?.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const { bank_name, ifsc, account_number, branch_address, account_holder_name } = await req.json();
    if (!bank_name?.trim()) {
      return NextResponse.json({ error: "Bank name is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    await ensureTable(conn);

    const [result] = await conn.execute(
      "INSERT INTO bank_masters (bank_name, ifsc, account_number, branch_address, account_holder_name) VALUES (?, ?, ?, ?, ?)",
      [
        bank_name.trim(),
        ifsc?.trim() || null,
        account_number?.trim() || null,
        branch_address?.trim() || null,
        account_holder_name?.trim() || null,
      ]
    );
    return NextResponse.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("[bank-masters] POST error:", err?.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
