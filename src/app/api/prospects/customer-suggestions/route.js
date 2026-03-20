import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessProspectsRole,
  isProspectsAdminRole,
} from "@/lib/prospectAccess";
import { extractQuoteNumberFromProspectSearch } from "@/lib/prospectFilterUtils";

function mapQuoteRow(row) {
  const clientName =
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
    row.company_name ||
    row.company ||
    "";
  return {
    customer_id: row.customer_id,
    quote_number: row.quote_number || null,
    client_name: clientName,
    email: row.email || "",
    phone: row.phone || "",
    quote_date: row.quote_date || null,
    grand_total: row.grand_total ?? null,
    created_by: row.emp_name || null,
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    company: row.company || "",
  };
}

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !canAccessProspectsRole(payload.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") ?? "").trim();
    if (q.length < 1) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const quoteToken =
      extractQuoteNumberFromProspectSearch(q) ||
      (q.toUpperCase().startsWith("QUOTE") ? q.trim() : null);
    if (!quoteToken) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const conn = await getDbConnection();
    const admin = isProspectsAdminRole(payload.role);
    const username = String(payload.username ?? "").trim();
    const ownerCustomer = admin
      ? ""
      : ` AND (c.assigned_to = ? OR c.lead_source = ?)`;

    if (!admin && !username) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const quoteParams = [`%${quoteToken}%`];
    if (!admin) quoteParams.push(username, username);

    const [quoteHits] = await conn.execute(
      `SELECT qr.quote_number, qr.quote_date, qr.grand_total, qr.emp_name, qr.company_name,
        c.customer_id, c.first_name, c.last_name, c.phone, c.company, c.email
       FROM quotations_records qr
       INNER JOIN customers c ON c.customer_id = qr.customer_id
       WHERE qr.quote_number LIKE ?
       ${ownerCustomer}
       ORDER BY qr.quote_date DESC, qr.created_at DESC
       LIMIT 20`,
      quoteParams,
    );

    const suggestions = (quoteHits || []).map(mapQuoteRow);

    return NextResponse.json({ success: true, suggestions });
  } catch (e) {
    console.error("prospects customer-suggestions:", e);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
