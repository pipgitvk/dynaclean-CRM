import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureServiceRecordsThirdPartyAssignColumns } from "@/lib/ensureServiceRecordsThirdPartyAssignColumns";
import { ensureServiceRecordsEngineerAssignedByColumn } from "@/lib/ensureServiceRecordsEngineerAssignedByColumn";

export async function POST(req) {
  try {
    const {
      service_id,
      assigned_to,
      third_party_engineer_id,
      installation_address,
      site_person,
      site_email,
      site_contact,
    } = await req.json();

    if (!service_id || !assigned_to) {
      return NextResponse.json(
        { success: false, message: "service_id and assigned_to are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    const [svcRows] = await conn.execute(
      `SELECT service_id, serial_number, UPPER(TRIM(COALESCE(service_type, ''))) AS service_type
       FROM service_records WHERE service_id = ? LIMIT 1`,
      [service_id],
    );
    const svc = svcRows?.[0];
    const isInstallation = svc?.service_type === "INSTALLATION";

    if (isInstallation) {
      const missing = [];
      if (!String(installation_address || "").trim()) {
        missing.push("installation_address");
      }
      if (!String(site_person || "").trim()) missing.push("site_person");
      if (!String(site_email || "").trim()) missing.push("site_email");
      if (!String(site_contact || "").trim()) missing.push("site_contact");
      if (missing.length) {
        return NextResponse.json(
          {
            success: false,
            message: `Missing: ${missing.join(", ")}`,
          },
          { status: 400 },
        );
      }
      if (String(assigned_to).trim().toUpperCase() === "NOT ASSIGNED") {
        return NextResponse.json(
          { success: false, message: "Please select an engineer to assign." },
          { status: 400 },
        );
      }
    }
    await ensureServiceRecordsThirdPartyAssignColumns(conn);
    await ensureServiceRecordsEngineerAssignedByColumn(conn);

    const payload = await getSessionPayload();
    const engineerAssignedBy =
      String(payload?.username || payload?.name || "").trim() || "admin";

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
           third_party_engineer_id = ?,
           engineer_assigned_by = ?
       WHERE service_id = ?`,
      [
        String(assigned_to).trim(),
        assignedToType,
        assignedToId,
        hasThirdParty ? tpId : null,
        engineerAssignedBy,
        service_id,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "No record found with that Service ID." },
        { status: 404 }
      );
    }

    if (isInstallation && svc?.serial_number) {
      await conn.execute(
        `UPDATE warranty_products
         SET installed_address = ?, site_person = ?, site_contact = ?, site_email = ?
         WHERE TRIM(serial_number) = TRIM(?)`,
        [
          String(installation_address).trim(),
          String(site_person).trim(),
          String(site_contact).trim(),
          String(site_email).trim(),
          svc.serial_number,
        ],
      );
    }

    return NextResponse.json({
      success: true,
      message: "Assigned successfully",
      engineer_assigned_by: engineerAssignedBy,
    });
  } catch (error) {
    console.error("Error assigning service:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
