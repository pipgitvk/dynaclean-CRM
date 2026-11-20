import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { getDbConnection } from "@/lib/db";
import { ensureServiceRecordsEngineerAssignedByColumn } from "@/lib/ensureServiceRecordsEngineerAssignedByColumn";
import { enrichOpenInstallationListServices } from "@/lib/serviceBeforeInstallationQueries";

/**
 * POST { rows: [{ quote_number, ... }] } — service/installation SR fields only (after fast list).
 */
export async function POST(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ success: true, data: [] });
    }
    if (rows.length > 50) {
      return NextResponse.json({ success: false, error: "Too many rows" }, { status: 400 });
    }

    const conn = await getDbConnection();
    await ensureServiceRecordsEngineerAssignedByColumn(conn);
    const data = await enrichOpenInstallationListServices(rows);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[open-installation/services-enrich]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}