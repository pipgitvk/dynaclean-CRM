import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { updateLatestFollowupNotesLanguage } from "@/lib/customerFollowupNotesLanguage";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      customer_id,
      first_name,
      company,
      email,
      tags,
      status,
      gstin,
      stage,
      address,
      notes_language,
    } = body;

    if (!customer_id) {
      return NextResponse.json({ error: "Missing customer_id" }, { status: 400 });
    }

    const conn = await getDbConnection();

    await conn.execute(
      `UPDATE customers SET first_name=?, company=?, email=?, tags=?, status=?, gstin=?, stage=?, address=? WHERE customer_id=?`,
      [first_name, company, email, tags, status, gstin ?? null, stage, address, customer_id],
    );

    if (notes_language !== undefined) {
      await updateLatestFollowupNotesLanguage(conn, customer_id, notes_language);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update failed:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
