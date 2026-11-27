import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { fetchServiceBeforeInstallationHubLastFollowups } from "@/lib/serviceBeforeInstallationHubLastFollowup";

export async function GET() {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const lastFollowups = await fetchServiceBeforeInstallationHubLastFollowups();
    return NextResponse.json({ success: true, lastFollowups });
  } catch (error) {
    console.error("[service-before-installation/hub/last-followups]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
