import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";
import { redirect } from "next/navigation";
import AddMetaCredentialForm from "@/components/meta-credentials/AddMetaCredentialForm";

export default async function DigitalMarketerAddMetaCredentialPage() {
  const payload = await getSessionPayload();
  const roleKey = normalizeRoleKey(payload?.role || "");

  if (roleKey !== "DIGITAL MARKETER") {
    redirect("/user-dashboard");
  }

  return (
    <AddMetaCredentialForm
      backPath="/digital-marketing-dashboard"
      cancelPath="/digital-marketing-dashboard"
      successRedirectPath="/digital-marketing-dashboard"
    />
  );
}
