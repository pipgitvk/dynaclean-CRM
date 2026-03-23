import nodemailer from "nodemailer";

/** Base URL for links in outbound emails (import CRM portals). */
export function getImportCrmPublicBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${String(vercel).replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export async function sendImportCrmSmtpEmail({ to, subject, html, text }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user) {
    throw new Error("SMTP not configured (SMTP_HOST / SMTP_USER)");
  }
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `"Dynaclean Industries" <${user}>`,
    to,
    subject,
    html,
    text: text || undefined,
  });
}

/** Email to awarded quote submitter with link to post-award follow-up form. */
export async function sendImportCrmAwardPortalEmail({ to, portalUrl }) {
  const subject = "Import shipment — please complete booking & document details";
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.55;color:#1e293b">
<p>Hello,</p>
<p>Your quote has been <strong>awarded</strong>. Please use the secure link below to fill in pickup / booking / vessel details and upload BL, invoice, packing list, and any other documents.</p>
<p style="margin:24px 0"><a href="${portalUrl}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Open form</a></p>
<p style="word-break:break-all;font-size:13px;color:#64748b">${portalUrl}</p>
<p style="font-size:13px;color:#64748b">निम्न लिंक पर जाकर फॉर्म भरें।</p>
<p>Thank you,<br/>Dynaclean Industries</p>
</body></html>`;
  await sendImportCrmSmtpEmail({ to, subject, html });
}
