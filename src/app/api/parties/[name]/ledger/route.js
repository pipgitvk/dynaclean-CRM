import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { buildLedgerForParty } from "@/lib/partyLedger";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const nameFromQuery = searchParams.get("name");

  let rawName = nameFromQuery;
  try {
    const p = await params;
    if (p?.name && p.name !== "[name]") {
      rawName = rawName ?? p.name;
    }
  } catch (_) {}

  if (!rawName) {
    return NextResponse.json(
      { error: "name param required (?name=...) or /api/parties/[name]/ledger" },
      { status: 400 }
    );
  }

  const decoded = decodeURIComponent(String(rawName)).trim();
  if (!decoded) {
    return NextResponse.json({ error: "name is empty" }, { status: 400 });
  }

  try {
    const { entries, customerId } = await buildLedgerForParty(
      decoded,
      searchParams.get("customer_id") ?? null
    );
    return NextResponse.json({
      success: true,
      party: { name: decoded, customer_id: customerId || null },
      entries,
    });
  } catch (err) {
    console.error("[party ledger GET]", err?.message);
    return NextResponse.json(
      { error: "DB error", message: err?.message },
      { status: 500 }
    );
  }
}
