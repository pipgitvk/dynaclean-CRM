import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const conn = await getDbConnection();
    await conn.execute(
      `CREATE TABLE IF NOT EXISTS expense_categories (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    const [rows] = await conn.execute(
      `SELECT id, name FROM expense_categories ORDER BY id ASC`
    );
    return NextResponse.json({ categories: rows });
  } catch (err) {
    console.error("[expense-categories] GET error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const data = await req.json();
    const name = (data.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    await conn.execute(
      `CREATE TABLE IF NOT EXISTS expense_categories (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    const [result] = await conn.execute(
      `INSERT INTO expense_categories (name) VALUES (?)`,
      [name]
    );
    return NextResponse.json({ id: Number(result.insertId), name });
  } catch (err) {
    console.error("[expense-categories] POST error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
