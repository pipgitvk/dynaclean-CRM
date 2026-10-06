import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getEngineerIdFromPayload } from "@/lib/thirdPartyEngineerPortalSession";
import { ensureThirdPartyEngineerColumns } from "@/lib/thirdPartyEngineerSchema";
import ThirdPartyEngineerPasswordForm from "@/components/thirdParty/ThirdPartyEngineerPasswordForm";

export const dynamic = "force-dynamic";

export default async function ThirdPartyEngineerProfilePage() {
  const payload = await getSessionPayload();
  const engineerId = getEngineerIdFromPayload(payload);
  if (!engineerId) redirect("/login");

  const conn = await getDbConnection();
  await ensureThirdPartyEngineerColumns(conn);

  const [rows] = await conn.execute(
    `SELECT engineer_id, name, mobile, secondary_contact_number, email, address, state,
            geo_location, remark, service_charge, status, created_at, updated_at
     FROM third_party_service_engineers WHERE engineer_id = ? LIMIT 1`,
    [engineerId]
  );
  const engineer = rows[0];
  if (!engineer) redirect("/login");

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
        <p className="text-slate-600 text-sm mt-1">Your registered details</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <p><span className="text-slate-500">Name:</span> {engineer.name}</p>
        <p><span className="text-slate-500">Email:</span> {engineer.email}</p>
        <p><span className="text-slate-500">Mobile:</span> {engineer.mobile}</p>
        <p>
          <span className="text-slate-500">Secondary contact:</span>{" "}
          {engineer.secondary_contact_number || "—"}
        </p>
        <p><span className="text-slate-500">State:</span> {engineer.state || "—"}</p>
        <p>
          <span className="text-slate-500">Service charge:</span>{" "}
          {engineer.service_charge != null
            ? `₹${Number(engineer.service_charge).toLocaleString("en-IN")}`
            : "—"}
        </p>
        <p className="md:col-span-2">
          <span className="text-slate-500">Address:</span> {engineer.address || "—"}
        </p>
        <p className="md:col-span-2">
          <span className="text-slate-500">Geo location:</span> {engineer.geo_location || "—"}
        </p>
        {engineer.remark && (
          <p className="md:col-span-2">
            <span className="text-slate-500">Remark:</span> {engineer.remark}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Change password</h2>
        <ThirdPartyEngineerPasswordForm />
      </div>
    </div>
  );
}
