import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

export async function PUT(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const { id } = await params;
    const { bank_name, ifsc, account_number, branch_address, account_holder_name } = await req.json();
    if (!bank_name?.trim()) {
      return NextResponse.json({ error: "Bank name is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [result] = await conn.execute(
      "UPDATE bank_masters SET bank_name = ?, ifsc = ?, account_number = ?, branch_address = ?, account_holder_name = ? WHERE id = ?",
      [
        bank_name.trim(),
        ifsc?.trim() || null,
        account_number?.trim() || null,
        branch_address?.trim() || null,
        account_holder_name?.trim() || null,
        id,
      ]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[bank-masters] PUT error:", err?.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const { id } = await params;
    const conn = await getDbConnection();
    const [result] = await conn.execute("DELETE FROM bank_masters WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[bank-masters] DELETE error:", err?.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
