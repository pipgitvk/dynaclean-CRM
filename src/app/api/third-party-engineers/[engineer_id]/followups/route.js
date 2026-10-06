import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { ensureThirdPartyEngineerFollowupsTable } from "@/lib/ensureThirdPartyEngineerFollowupsTable";
import {
  getEngineerIfAccessible,
  normalizeDatetimeLocal,
  verifyThirdPartyEngineerModuleAccess,
} from "@/lib/thirdPartyEngineerAccess";
import { validateNextFollowupDate } from "@/lib/manualPaymentFollowupValidation";

/**
 * GET /api/third-party-engineers/[engineer_id]/followups
 * List follow-up history for an engineer (newest first)
 */
export async function GET(req, context) {
  try {
    const auth = await verifyThirdPartyEngineerModuleAccess();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const params = await context.params;
    const engineerId = Number(params.engineer_id);
    if (!Number.isFinite(engineerId) || engineerId < 1) {
      return NextResponse.json({ error: "Invalid engineer ID" }, { status: 400 });
    }

    const conn = await getDbConnection();
    await ensureThirdPartyEngineerFollowupsTable(conn);

    const { engineer, forbidden } = await getEngineerIfAccessible(
      conn,
      engineerId,
      auth.payload,
      auth.roleNorm
    );

    if (forbidden) {
      return NextResponse.json(
        { error: "Forbidden: You can only access your own engineers" },
        { status: 403 }
      );
    }
    if (!engineer) {
      return NextResponse.json({ error: "Engineer not found" }, { status: 404 });
    }

    const [rows] = await conn.execute(
      `SELECT
         id,
         engineer_id,
         followed_date,
         communication_mode,
         next_followup_date,
         notes,
         created_by,
         created_at
       FROM third_party_engineer_followups
       WHERE engineer_id = ?
       ORDER BY created_at DESC, id DESC`,
      [engineerId]
    );

    return NextResponse.json({
      success: true,
      engineer,
      followups: rows || [],
    });
  } catch (error) {
    console.error("Error fetching third-party engineer followups:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow-ups", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/third-party-engineers/[engineer_id]/followups
 * Add a new follow-up entry (append-only history)
 */
export async function POST(req, context) {
  try {
    const auth = await verifyThirdPartyEngineerModuleAccess();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const params = await context.params;
    const engineerId = Number(params.engineer_id);
    if (!Number.isFinite(engineerId) || engineerId < 1) {
      return NextResponse.json({ error: "Invalid engineer ID" }, { status: 400 });
    }

    const body = await req.json();
    const followedDate =
      normalizeDatetimeLocal(body?.followed_date) ||
      normalizeDatetimeLocal(new Date().toISOString().slice(0, 16));
    const communicationMode = body?.communication_mode
      ? String(body.communication_mode).trim()
      : "Call";
    const nextFollowupDate = normalizeDatetimeLocal(body?.next_followup_date);
    const notes = body?.notes ? String(body.notes).trim() : "";

    if (!notes) {
      return NextResponse.json({ error: "notes is required" }, { status: 400 });
    }

    const nextDateCheck = validateNextFollowupDate(nextFollowupDate);
    if (!nextDateCheck.ok) {
      return NextResponse.json({ error: nextDateCheck.error }, { status: 400 });
    }

    const conn = await getDbConnection();
    await ensureThirdPartyEngineerFollowupsTable(conn);

    const { engineer, forbidden } = await getEngineerIfAccessible(
      conn,
      engineerId,
      auth.payload,
      auth.roleNorm
    );

    if (forbidden) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own engineers" },
        { status: 403 }
      );
    }
    if (!engineer) {
      return NextResponse.json({ error: "Engineer not found" }, { status: 404 });
    }

    const createdBy = auth.payload.username || auth.payload.email || null;

    const [result] = await conn.execute(
      `INSERT INTO third_party_engineer_followups
         (engineer_id, followed_date, communication_mode, next_followup_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        engineerId,
        followedDate,
        communicationMode || null,
        nextFollowupDate,
        notes,
        createdBy,
      ]
    );

    return NextResponse.json({
      success: true,
      id: result?.insertId || null,
      message: "Follow-up saved",
    });
  } catch (error) {
    console.error("Error creating third-party engineer followup:", error);
    return NextResponse.json(
      { error: "Failed to save follow-up", details: error.message },
      { status: 500 }
    );
  }
}
