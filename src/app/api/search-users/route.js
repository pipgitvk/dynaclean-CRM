import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  const { search } = await req.json();

  if (!search || search.length < 2) {
    return NextResponse.json([], { status: 200 });
  }

  const connection =await getDbConnection();

  const [rows] = await connection.execute(
    "SELECT username, userRole FROM rep_list WHERE username LIKE ? AND status = 1 LIMIT 10",
    [`%${search}%`]
  );

      // await connection.end();

  return NextResponse.json(rows);
}
