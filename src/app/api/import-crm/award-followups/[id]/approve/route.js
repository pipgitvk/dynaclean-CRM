import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";
import { generateImportCrmQuoteToken } from "@/lib/generateImportCrmQuoteToken";
import {
  getImportCrmPublicBaseUrl,
  sendImportCrmBillingEmail,
} from "@/lib/importCrmEmail";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

/** Approve a submitted award follow-up form. */
export async function POST(_request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!isImportCrmAdmin(payload.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id: raw } = await params;
    const id = Number.parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();

    const [found] = await db.query(
      `SELECT q.id, q.award_form_submitted_at, q.af_approved_at,
              q.submitter_email, q.shipment_id,
              s.ship_from, s.ship_to
       FROM import_crm_shipment_link_quotes q
       INNER JOIN import_crm_shipments s ON s.id = q.shipment_id
       WHERE q.id = ? LIMIT 1`,
      [id],
    );
    const row = found?.[0];
    if (!row) {
      return NextResponse.json(
        { message: "Follow-up not found" },
        { status: 404 },
      );
    }
    if (!row.award_form_submitted_at) {
      return NextResponse.json(
        { message: "Cannot approve: follow-up form not yet submitted." },
        { status: 409 },
      );
    }
    if (row.af_approved_at) {
      return NextResponse.json(
        { message: "Already approved.", already: true },
        { status: 200 },
      );
    }

    const [updated] = await db.query(
      `UPDATE import_crm_shipment_link_quotes
       SET af_approved_at = CURRENT_TIMESTAMP, af_approved_by = ?
       WHERE id = ?`,
      [payload.username || null, id],
    );

    let billingUrl = null;
    let emailSent = false;
    let emailSkipped = false;
    let emailError = null;

    if (updated.affectedRows > 0) {
      const shipmentId = row.shipment_id;
      if (shipmentId) {
        await db.query(
          `UPDATE import_crm_shipments SET status = 'APPROVED_FOR_MOVEMENT' WHERE id = ?`,
          [shipmentId],
        );
      }

      // Create billing record with unique portal token
      const agentEmail = row.submitter_email || null;
      let billingToken = generateImportCrmQuoteToken();
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await db.query(
            `INSERT INTO import_crm_billing
               (link_quote_id, shipment_id, agent_email, billing_portal_token)
             VALUES (?, ?, ?, ?)`,
            [id, shipmentId, agentEmail, billingToken],
          );
          break;
        } catch (err) {
          if (err?.code === "ER_DUP_ENTRY" && attempt < 4) {
            billingToken = generateImportCrmQuoteToken();
            continue;
          }
          throw err;
        }
      }

      const baseUrl = getImportCrmPublicBaseUrl();
      billingUrl = `${baseUrl}/import-billing/${billingToken}`;

      const isRealEmail = (s) => {
        const t = String(s ?? "").trim().toLowerCase();
        return t && !t.includes("@shipment-quote.local") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
      };

      if (!isRealEmail(agentEmail)) {
        emailSkipped = true;
      } else {
        const shipmentRef = shipmentId ? String(shipmentId) : null;
        try {
          await sendImportCrmBillingEmail({
            to: String(agentEmail).trim().toLowerCase(),
            billingUrl,
            shipmentRef,
          });
          emailSent = true;
        } catch (err) {
          emailError = String(err?.message || err);
          console.error("import-crm billing email:", err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: emailSent
        ? "Follow-up approved — billing form sent to agent."
        : emailSkipped
          ? "Follow-up approved — no valid agent email (billing link not sent)."
          : "Follow-up approved — billing email failed; check SMTP.",
      billingUrl: emailSent ? undefined : billingUrl,
      emailSent,
      emailSkipped,
      emailError: emailError || undefined,
    });
  } catch (error) {
    console.error("import-crm award-followups approve POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
