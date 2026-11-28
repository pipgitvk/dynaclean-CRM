import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { fetchSbiExpenseServiceOptions } from "@/lib/fetchSbiExpenseServiceOptions";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    const username = payload.username;
    const { searchParams } = new URL(req.url);
    const serviceType = searchParams.get("service_type") || "";

    if (!String(serviceType).trim()) {
      return NextResponse.json({ error: "service_type is required" }, { status: 400 });
    }

    const data = await fetchSbiExpenseServiceOptions({
      username,
      serviceType,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[expenses/sbi-service-options]", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}