import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import {
  syncAllPartyLedgersToDatabase,
  syncPartyLedgerToDatabase,
  getPartyLedgerSnapshotStats,
} from "@/lib/partyLedgerSync";

export const dynamic = "force-dynamic";

const PRIVILEGED = new Set(["ADMIN", "SUPERADMIN"]);

function isPrivileged(payload) {
  return PRIVILEGED.has(String(payload?.role || "").toUpperCase());
}

export async function GET() {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrivileged(payload)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const stats = await getPartyLedgerSnapshotStats();
    return NextResponse.json({ success: true, ...stats });
  } catch (err) {
    console.error("[party ledger sync GET]", err?.message);
    return NextResponse.json(
      { error: "Failed to read snapshot stats", message: err?.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrivileged(payload)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch (_) {
    body = {};
  }

  try {
    if (body.syncAll) {
      const result = await syncAllPartyLedgersToDatabase({
        skipExistingParties: body.force !== true,
        replace: body.replace === true,
      });
      return NextResponse.json({ success: true, ...result });
    }

    const partyName = body.party_name || body.name;
    if (!partyName || !String(partyName).trim()) {
      return NextResponse.json(
        { error: "party_name is required (or set syncAll: true)" },
        { status: 400 },
      );
    }

    const result = await syncPartyLedgerToDatabase(
      String(partyName).trim(),
      body.customer_id ?? null,
      {
        skipExistingParty: body.force !== true,
        replace: body.replace === true,
      },
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[party ledger sync POST]", err?.message);
    return NextResponse.json(
      { error: "Sync failed", message: err?.message },
      { status: 500 },
    );
  }
}
