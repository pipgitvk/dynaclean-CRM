import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { ensureServiceRecordsThirdPartyAssignColumns } from "@/lib/ensureServiceRecordsThirdPartyAssignColumns";

export async function POST(req) {
  try {
    const { service_id, assigned_to, third_party_engineer_id } = await req.json();

    if (!service_id || !assigned_to) {
      return NextResponse.json(
        { success: false, message: "service_id and assigned_to are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    await ensureServiceRecordsThirdPartyAssignColumns(conn);

    const tpIdRaw = third_party_engineer_id;
    const tpId =
      tpIdRaw === "" || tpIdRaw === null || tpIdRaw === undefined
        ? null
        : Number(tpIdRaw);
    const hasThirdParty = Number.isFinite(tpId) && tpId > 0;

    let assignedToType = hasThirdParty ? "third_party" : "internal";
    let assignedToId = hasThirdParty ? tpId : null;

    if (hasThirdParty) {
      const [engRows] = await conn.execute(
        `SELECT engineer_id, name FROM third_party_service_engineers
         WHERE engineer_id = ? AND status = 'active' LIMIT 1`,
        [tpId]
      );
      if (!engRows.length) {
        return NextResponse.json(
          { success: false, message: "Third-party engineer not found or inactive" },
          { status: 400 }
        );
      }
    }

    const [result] = await conn.execute(
      `UPDATE service_records
       SET assigned_to = ?,
           assigned_to_type = ?,
           assigned_to_id = ?,
           third_party_engineer_id = ?
       WHERE service_id = ?`,
      [
        String(assigned_to).trim(),
        assignedToType,
        assignedToId,
        hasThirdParty ? tpId : null,
        service_id,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "No record found with that Service ID." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Assigned successfully" });
  } catch (error) {
    console.error("Error assigning service:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
