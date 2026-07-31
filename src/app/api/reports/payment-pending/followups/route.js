import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePaymentPendingFollowupsTable } from "@/lib/ensurePaymentPendingFollowupsTable";

const allowedRoles = [
  "SUPERADMIN",
  "ADMIN",
  "ACCOUNTANT",
  "HR HEAD",
  "SALES",
  "SALES CUM BACKOFFICE",
  "TEAM LEADER",
  "DIRECTOR",
  "GEM PORTAL",
  "GEM",
];

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

    const { role } = payload;
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    await ensurePaymentPendingFollowupsTable();
    const conn = await getDbConnection();

    const [rows] = await conn.query(
      `
        SELECT
          id,
          order_id,
          customer_id,
          client_name,
          company_name,
          contact,
          created_by,
          followed_date,
          communication_mode,
          next_followup_date,
          notes,
          created_at
        FROM payment_pending_followups
        WHERE order_id = ?
        ORDER BY created_at DESC, id DESC
      `,
      [orderId],
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

    const { role, username } = payload;
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();

    const orderId = body?.order_id ? String(body.order_id).trim() : "";
    const customerId =
      body?.customer_id === null || body?.customer_id === undefined
        ? null
        : String(body.customer_id).trim() || null;
    const followedDate = normalizeDatetimeLocal(body?.followed_date);
    const communicationMode = body?.communication_mode
      ? String(body.communication_mode).trim()
      : null;
    const nextFollowupDate = normalizeDatetimeLocal(body?.next_followup_date);
    const notes = body?.notes ? String(body.notes).trim() : "";
    const clientName = body?.client_name ? String(body.client_name).trim() : null;
    const companyName = body?.company_name ? String(body.company_name).trim() : null;
    const contact = body?.contact ? String(body.contact).trim() : null;

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json({ error: "notes is required" }, { status: 400 });
    }

    await ensurePaymentPendingFollowupsTable();
    const conn = await getDbConnection();

    const [result] = await conn.execute(
      `
        INSERT INTO payment_pending_followups
          (order_id, customer_id, client_name, company_name, contact, created_by, followed_date, communication_mode, next_followup_date, notes)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        orderId,
        customerId,
        clientName,
        companyName,
        contact,
        username || null,
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
