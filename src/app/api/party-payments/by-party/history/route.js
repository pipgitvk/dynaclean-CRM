import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { listPartyPaymentHistoryForParty } from "@/lib/partyPaymentHistory";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = String(searchParams.get("customer_id") || "").trim();
    const partyName = String(searchParams.get("name") || "").trim();

    const nameAliases = [];
    if (partyName) nameAliases.push(partyName);
    for (const alias of searchParams.getAll("alias")) {
      const a = String(alias || "").trim();
      if (a && !nameAliases.some((x) => x.toLowerCase() === a.toLowerCase())) {
        nameAliases.push(a);
      }
    }

    if (!customerId && !partyName) {
      return NextResponse.json(
        { error: "customer_id or name is required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();
    const history = await listPartyPaymentHistoryForParty(conn, {
      customerId: customerId || null,
      nameAliases,
    });

    return NextResponse.json({ success: true, history });
  } catch (err) {
    console.error("[party-payments/by-party/history] GET:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}