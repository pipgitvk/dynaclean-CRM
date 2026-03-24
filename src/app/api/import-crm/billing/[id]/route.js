import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";
import { generateImportCrmQuoteToken } from "@/lib/generateImportCrmQuoteToken";
import {
  getImportCrmPublicBaseUrl,
  sendImportCrmBillingEmail,
} from "@/lib/importCrmEmail";

const VALID_STATUSES = ["APPROVED", "HOLD", "REJECTED"];

function isAdmin(role) {
  return role === "SUPERADMIN";
}

/** PUT /api/import-crm/billing/[id]
 *  body JSON: { action: "APPROVED"|"HOLD"|"REJECTED"|"REASSIGN", admin_remarks?: string }
 */
export async function PUT(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!isAdmin(payload.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { id: raw } = await params;
    const id = Number.parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim().toUpperCase();
    const admin_remarks = String(body?.admin_remarks ?? "").trim() || null;
    const approved_amount_raw = String(body?.approved_amount ?? "").trim();
    const approved_amount =
      approved_amount_raw !== "" && Number.isFinite(Number(approved_amount_raw))
        ? Number(approved_amount_raw)
        : null;

    if (!action) {
      return NextResponse.json({ message: "action is required" }, { status: 400 });
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();

    const [found] = await db.query(
      `SELECT b.id, b.submitted_at, b.status, b.agent_email,
              b.shipment_id, s.ship_from, s.ship_to
       FROM import_crm_billing b
       LEFT JOIN import_crm_shipments s ON s.id = b.shipment_id
       WHERE b.id = ? LIMIT 1`,
      [id],
    );
    const row = found?.[0];
    if (!row) return NextResponse.json({ message: "Billing record not found" }, { status: 404 });

    const actor = payload.username || null;

    /* ── Status change: APPROVED / HOLD / REJECTED ── */
    if (VALID_STATUSES.includes(action)) {
      if (action === "APPROVED") {
        await db.query(
          `UPDATE import_crm_billing
           SET status = ?, admin_remarks = ?, approved_amount = ?,
               actioned_by = ?, actioned_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [action, admin_remarks, approved_amount, actor, id],
        );
        // Advance shipment status → BILL_PAYMENT_PENDING
        if (row.shipment_id) {
          await db.query(
            `UPDATE import_crm_shipments SET status = 'BILL_PAYMENT_PENDING' WHERE id = ?`,
            [row.shipment_id],
          );
        }
      } else {
        await db.query(
          `UPDATE import_crm_billing
           SET status = ?, admin_remarks = ?,
               actioned_by = ?, actioned_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [action, admin_remarks, actor, id],
        );
      }
      return NextResponse.json({ ok: true, status: action, approved_amount });
    }

    /* ── Re-assign: reset form + new token + email ── */
    if (action === "REASSIGN") {
      let newToken = generateImportCrmQuoteToken();
      // retry on rare collision
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await db.query(
            `UPDATE import_crm_billing
             SET billing_portal_token = ?,
                 bill_no = NULL, bill_date = NULL, bill_amount = NULL,
                 bill_file = NULL, remarks = NULL, with_invoice = 0,
                 submitted_at = NULL,
                 status = 'PENDING',
                 admin_remarks = ?, actioned_by = ?, actioned_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newToken, admin_remarks, actor, id],
          );
          break;
        } catch (err) {
          if (err?.code === "ER_DUP_ENTRY" && attempt < 4) {
            newToken = generateImportCrmQuoteToken();
            continue;
          }
          throw err;
        }
      }

      const baseUrl = getImportCrmPublicBaseUrl();
      const billingUrl = `${baseUrl}/import-billing/${newToken}`;

      const isRealEmail = (s) => {
        const t = String(s ?? "").trim().toLowerCase();
        return t && !t.includes("@shipment-quote.local") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
      };

      let emailSent = false;
      let emailError = null;

      if (isRealEmail(row.agent_email)) {
        const shipmentRef = row.shipment_id ? String(row.shipment_id) : null;
        try {
          await sendImportCrmBillingEmail({
            to: String(row.agent_email).trim().toLowerCase(),
            billingUrl,
            shipmentRef,
          });
          emailSent = true;
        } catch (err) {
          emailError = String(err?.message || err);
          console.error("billing reassign email:", err);
        }
      }

      return NextResponse.json({
        ok: true,
        status: "PENDING",
        billingUrl: emailSent ? undefined : billingUrl,
        emailSent,
        emailError: emailError || undefined,
        message: emailSent
          ? "Re-assigned — new billing form sent to agent."
          : "Re-assigned — no valid email found, link generated but not sent.",
      });
    }

    return NextResponse.json({ message: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("billing PUT:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
