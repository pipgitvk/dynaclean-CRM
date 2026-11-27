import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureServiceRecordsThirdPartyAssignColumns } from "@/lib/ensureServiceRecordsThirdPartyAssignColumns";
import { ensureServiceRecordsEngineerAssignedByColumn } from "@/lib/ensureServiceRecordsEngineerAssignedByColumn";
import { sqlTrimUtf8Eq, sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";

function pickFirst(...values) {
  for (const value of values) {
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

async function resolveInstallationSite(conn, svc, body) {
  let installation_address = pickFirst(body.installation_address);
  let site_person = pickFirst(body.site_person);
  let site_email = pickFirst(body.site_email);
  let site_contact = pickFirst(body.site_contact);

  const serial = pickFirst(svc?.serial_number);
  if (serial && (!installation_address || !site_person || !site_email || !site_contact)) {
    const [wpRows] = await conn.execute(
      `SELECT installed_address, site_person, site_email, site_contact,
              contact, email, contact_person
       FROM warranty_products
       WHERE ${sqlTrimUtf8Eq("serial_number")}
       ORDER BY id DESC
       LIMIT 1`,
      [serial],
    );
    const wp = wpRows?.[0];
    if (wp) {
      installation_address = pickFirst(installation_address, wp.installed_address);
      site_person = pickFirst(site_person, wp.site_person, wp.contact_person);
      site_email = pickFirst(site_email, wp.site_email, wp.email);
      site_contact = pickFirst(site_contact, wp.site_contact, wp.contact);
    }
  }

  if (!installation_address || !site_person || !site_email || !site_contact) {
    try {
      const [orderRows] = await conn.execute(
        `SELECT
           no.delivery_location,
           no.company_address,
           no.client_name,
           no.email AS order_email,
           no.contact AS order_contact,
           cust.email AS customer_email
         FROM service_records sr
         LEFT JOIN dispatch d
           ON ${sqlTrimUtf8EqColumns("d.serial_no", "sr.serial_number")}
         LEFT JOIN neworder no
           ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
         LEFT JOIN quotations_records qr
           ON ${sqlTrimUtf8EqColumns("qr.quote_number", "no.quote_number")}
         LEFT JOIN customers cust
           ON cust.customer_id = qr.customer_id
         WHERE sr.service_id = ?
         LIMIT 1`,
        [svc.service_id],
      );
      const order = orderRows?.[0];
      if (order) {
        installation_address = pickFirst(
          installation_address,
          order.delivery_location,
          order.company_address,
        );
        site_person = pickFirst(site_person, order.client_name);
        site_email = pickFirst(site_email, order.order_email, order.customer_email);
        site_contact = pickFirst(site_contact, order.order_contact);
      }
    } catch (err) {
      console.warn(
        "[service-status/assign] order site fallback skipped:",
        err?.message || err,
      );
    }
  }

  return { installation_address, site_person, site_email, site_contact };
}

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
    let site = {
      installation_address,
      site_person,
      site_email,
      site_contact,
    };

    if (isInstallation) {
      site = await resolveInstallationSite(conn, svc, site);
      const missing = [];
      if (!site.installation_address) missing.push("installation_address");
      if (!site.site_person) missing.push("site_person");
      if (!site.site_email) missing.push("site_email");
      if (!site.site_contact) missing.push("site_contact");
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
          site.installation_address,
          site.site_person,
          site.site_contact,
          site.site_email,
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
