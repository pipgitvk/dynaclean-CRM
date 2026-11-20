import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { checkMetaCredentialsAccess } from "@/lib/checkMetaCredentialsAccess";
import { getAllCredentials } from "@/lib/mysql/metaCredentialModel";
import { countLeadsStatsForFormIds } from "@/lib/mysql/metaLeadModel";

function parseYmd(value) {
  const s = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkMetaCredentialsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: "You do not have access to Meta forms." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const from = parseYmd(searchParams.get("from") || searchParams.get("startDate"));
    const to = parseYmd(searchParams.get("to") || searchParams.get("endDate"));
    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: "from and to (YYYY-MM-DD) are required." },
        { status: 400 },
      );
    }

    const credentials = await getAllCredentials(true);
    const byCredentialId = {};

    await Promise.all(
      credentials.map(async (cred) => {
        const id = String(cred._id ?? cred.id ?? "");
        if (!id) return;
        const formIds = Array.isArray(cred.formIds) ? cred.formIds : [];
        byCredentialId[id] = await countLeadsStatsForFormIds(formIds, {
          startDate: from,
          endDate: to,
        });
      }),
    );

    return NextResponse.json({
      success: true,
      from,
      to,
      byCredentialId,
    });
  } catch (error) {
    console.error("[leads-manage/meta-credential-stats]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}