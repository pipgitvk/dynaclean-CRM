import { NextResponse } from "next/server";

/**
 * All legacy expense attachment URL shapes resolve to the same canonical path
 * (`/expense_attachments/<file>`) and `/api/open-attachment`, which probes
 * app + service so both deploys behave the same.
 */
export function redirectExpenseFileToOpenAttachment(req, fileName) {
  const name = String(fileName || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Missing file name" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const target = `${origin}/api/open-attachment?path=${encodeURIComponent(
    `/expense_attachments/${name}`
  )}`;

  return NextResponse.redirect(target, 307);
}
