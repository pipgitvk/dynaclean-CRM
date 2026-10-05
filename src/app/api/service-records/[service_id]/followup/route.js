import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureServiceRecordsFollowupColumns } from "@/lib/ensureServiceRecordsFollowupColumns";

const ALLOWED_ROLES = new Set([
  "SUPERADMIN",
  "ADMIN",
  "SERVICE HEAD",
  "SERVICE SUPPORT",
  "SERVICE ENGINEER",
  "DIRECTOR",
]);

function parseRating(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return Math.round(n);
}

export async function PATCH(request, context) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.role || !ALLOWED_ROLES.has(String(payload.role).trim())) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const serviceId = params?.service_id;
    if (!serviceId) {
      return NextResponse.json({ message: "Service ID required" }, { status: 400 });
    }

    const body = await request.json();
    const mailSent = body.mail_sent === true || body.mail_sent === 1 ? 1 : 0;
    const feedback =
      body.final_feedback_on_call != null
        ? String(body.final_feedback_on_call).trim()
        : "";
    const rating = parseRating(body.service_rating);

    await ensureServiceRecordsFollowupColumns();
    const db = await getDbConnection();

    const [existing] = await db.execute(
      "SELECT service_id FROM service_records WHERE service_id = ? LIMIT 1",
      [serviceId]
    );
    if (!existing.length) {
      return NextResponse.json({ message: "Service record not found" }, { status: 404 });
    }

    await db.execute(
      `UPDATE service_records
       SET mail_sent = ?,
           final_feedback_on_call = ?,
           service_rating = ?,
           service_followup_at = NOW()
       WHERE service_id = ?`,
      [mailSent, feedback || null, rating, serviceId]
    );

    const [rows] = await db.execute(
      `SELECT service_id, mail_sent, final_feedback_on_call, service_rating, service_followup_at
       FROM service_records WHERE service_id = ? LIMIT 1`,
      [serviceId]
    );

    return NextResponse.json({ success: true, record: rows[0] });
  } catch (err) {
    console.error("service followup PATCH:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
