import nodemailer from "nodemailer";

/** Base URL for links in outbound emails (import CRM portals). */
export function getImportCrmPublicBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${String(vercel).replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/**
 * Build nodemailer transport for shared hosting / cPanel style SMTP.
 * - Trims env values (fixes common production copy/paste issues).
 * - Port 587: requireTLS for STARTTLS (many servers reject auth without it).
 * - Optional: SMTP_SECURE=true to force TLS (e.g. if you use port 465).
 * - Optional: SMTP_FROM=full@address — use if "from" must differ; many hosts need SMTP_USER = full mailbox email.
 */
function createImportCrmTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user) {
    throw new Error("SMTP not configured (SMTP_HOST / SMTP_USER)");
  }
  if (pass === undefined || pass === "") {
    throw new Error("SMTP_PASS is missing or empty");
  }
  const secureExplicit =
    String(process.env.SMTP_SECURE || "")
      .toLowerCase()
      .trim() === "true";
  const secure = port === 465 || secureExplicit;
  const rejectUnauthorized =
    String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true")
      .toLowerCase()
      .trim() !== "false";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && (port === 587 || port === 25),
    auth: { user, pass },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized,
    },
    connectionTimeout: 25_000,
    greetingTimeout: 25_000,
  });
}

export async function sendImportCrmSmtpEmail({ to, subject, html, text }) {
  const user = process.env.SMTP_USER?.trim();
  const fromOverride = process.env.SMTP_FROM?.trim();
  const from = fromOverride
    ? `"Dynaclean Industries" <${fromOverride}>`
    : `"Dynaclean Industries" <${user}>`;

  const transporter = createImportCrmTransporter();
  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: text || undefined,
  });
}

/** Payment notification to agent after admin records a payment. */
export async function sendImportCrmPaymentEmail({
  to, shipmentRef, paymentDate, paymentMode, transactionNo, amountPaid,
  proofUrl, adminRemarks,
}) {
  const ref = shipmentRef ? ` (Shipment #${shipmentRef})` : "";
  const subject = `Payment processed${ref}`;

  const fmtAmount = amountPaid != null
    ? `₹ ${Number(amountPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
    : "—";

  const rows = [
    ["Payment date",    paymentDate || "—"],
    ["Payment mode",    paymentMode || "—"],
    ["Transaction no.", transactionNo || "—"],
    ["Amount paid",     fmtAmount],
    ...(adminRemarks ? [["Remarks", adminRemarks]] : []),
  ].map(([k, v]) =>
    `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;white-space:nowrap">${k}</td>
         <td style="padding:6px 12px;color:#0f172a;font-size:13px;font-weight:600">${v}</td></tr>`,
  ).join("");

  const proofSection = proofUrl
    ? `<p style="margin:20px 0 8px;font-size:13px;color:#475569;font-weight:600">Payment proof:</p>
       <p style="margin:0"><a href="${proofUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">View Payment Proof</a></p>`
    : "";

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.6;color:#1e293b;max-width:560px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 16px">Hello,</p>
<p style="margin:0 0 16px">A payment has been processed for your shipment${ref}. Details below:</p>
<table style="border-collapse:collapse;width:100%;margin:0 0 16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <tbody>${rows}</tbody>
</table>
${proofSection}
<p style="margin:24px 0 0">Thank you,<br/>Dynaclean Industries</p>
</body></html>`;

  const text = `Hello,\n\nA payment has been processed for your shipment${ref}.\n\nPayment date: ${paymentDate || "—"}\nPayment mode: ${paymentMode || "—"}\nTransaction no.: ${transactionNo || "—"}\nAmount paid: ${fmtAmount}\n${adminRemarks ? `Remarks: ${adminRemarks}\n` : ""}${proofUrl ? `\nView payment proof: ${proofUrl}\n` : ""}\nThank you,\nDynaclean Industries`;

  await sendImportCrmSmtpEmail({ to, subject, html, text });
}

/** Email to agent after approval — link to billing form. */
export async function sendImportCrmBillingEmail({ to, billingUrl, shipmentRef }) {
  const subject = "Import shipment — please submit your billing details";
  const ref = shipmentRef ? ` (Shipment #${shipmentRef})` : "";
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.55;color:#1e293b">
<p>Hello,</p>
<p>Your shipment execution${ref} has been <strong>approved</strong>. Please submit your billing details — bill number, date, amount, and invoice — using the link below.</p>
<p style="margin:24px 0"><a href="${billingUrl}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Submit billing details</a></p>
<p>Thank you,<br/>Dynaclean Industries</p>
</body></html>`;
  const text = `Hello,\n\nYour shipment execution${ref} has been approved. Please submit your billing details:\n${billingUrl}\n\nThank you,\nDynaclean Industries`;
  await sendImportCrmSmtpEmail({ to, subject, html, text });
}

/** Email to awarded quote submitter with link to post-award follow-up form. */
export async function sendImportCrmAwardPortalEmail({ to, portalUrl }) {
  const subject = "Import shipment — please complete booking & document details";
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.55;color:#1e293b">
<p>Hello,</p>
<p>Your quote has been <strong>awarded</strong>. Use the button below to fill in pickup / booking / vessel details and upload BL, invoice, packing list, and any other documents.</p>
<p style="margin:24px 0"><a href="${portalUrl}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Open form</a></p>
<p>Thank you,<br/>Dynaclean Industries</p>
</body></html>`;
  const text = `Hello,\n\nYour quote has been awarded. Open the form:\n${portalUrl}\n\nThank you,\nDynaclean Industries`;
  await sendImportCrmSmtpEmail({ to, subject, html, text });
}
