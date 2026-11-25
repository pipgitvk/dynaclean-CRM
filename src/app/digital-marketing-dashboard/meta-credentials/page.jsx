import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";
import { redirect } from "next/navigation";
import MetaCredentialsManageClient from "@/components/meta-credentials/MetaCredentialsManageClient";

export default async function DigitalMarketerMetaCredentialsPage() {
  const payload = await getSessionPayload();
  const roleKey = normalizeRoleKey(payload?.role || "");

  if (roleKey !== "DIGITAL MARKETER") {
    redirect("/user-dashboard");
  }

  return <MetaCredentialsManageClient variant="marketer" />;
}