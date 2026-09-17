import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureManualPaymentFollowupsTable } from "@/lib/ensureManualPaymentFollowupsTable";

const allowedRoles = [
  "SUPERADMIN",
  "ADMIN",
  "ACCOUNTANT",
  "DIRECTOR",
  "SALES CUM BACKOFFICE",
];

function hasAccess(role) {
  const roleNorm = String(role || "").toUpperCase().trim();
  return allowedRoles.includes(roleNorm);
}

function normalizeDatetimeLocal(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes("T")) {
    const replaced = raw.replace("T", " ");
    if (replaced.length === 16) return `${replaced}:00`;
    return replaced;
  }
  return raw;
}

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasAccess(payload.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("payment_id");

    if (!paymentId) {
      return NextResponse.json({ error: "payment_id is required" }, { status: 400 });
    }

    await ensureManualPaymentFollowupsTable();
    const conn = await getDbConnection();

    const [rows] = await conn.execute(
      `SELECT
         id,
         payment_id,
         customer_name,
         customer_phone,
         created_by,
         followed_date,
         communication_mode,
         next_followup_date,
         notes,
         created_at
       FROM manual_payment_followups
       WHERE payment_id = ?
       ORDER BY created_at DESC, id DESC`,
      [paymentId],
    );

    return NextResponse.json({ success: true, followups: rows || [] });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasAccess(payload.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const paymentId = Number(body?.payment_id);
    const followedDate = normalizeDatetimeLocal(body?.followed_date);
    const communicationMode = body?.communication_mode
      ? String(body.communication_mode).trim()
      : null;
    const nextFollowupDate = normalizeDatetimeLocal(body?.next_followup_date);
    const notes = body?.notes ? String(body.notes).trim() : "";
    const customerName = body?.customer_name ? String(body.customer_name).trim() : null;
    const customerPhone = body?.customer_phone ? String(body.customer_phone).trim() : null;

    if (!Number.isFinite(paymentId) || paymentId < 1) {
      return NextResponse.json({ error: "payment_id is required" }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json({ error: "notes is required" }, { status: 400 });
    }

    await ensureManualPaymentFollowupsTable();
    const conn = await getDbConnection();

    const [paymentRows] = await conn.execute(
      "SELECT id FROM manual_payment_pending WHERE id = ? LIMIT 1",
      [paymentId],
    );
    if (!paymentRows.length) {
      return NextResponse.json({ error: "Payment entry not found" }, { status: 404 });
    }

    const [result] = await conn.execute(
      `INSERT INTO manual_payment_followups
         (payment_id, customer_name, customer_phone, created_by, followed_date, communication_mode, next_followup_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        customerName,
        customerPhone,
        payload.username || null,
        followedDate || null,
        communicationMode || null,
        nextFollowupDate || null,
        notes,
      ],
    );

    return NextResponse.json({ success: true, id: result?.insertId || null });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 },
    );
  }
}
