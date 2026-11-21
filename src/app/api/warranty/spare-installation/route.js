import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";
import { ensureSpareInstallationRecordsTable } from "@/lib/ensureSpareInstallationRecordsTable";
import { sendTemplatedEmail } from "@/lib/template-utils";

export async function GET(req) {
  const token = req.cookies.get("token")?.value;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "200", 10)));

  try {
    const pool = await getDbConnection();
    await ensureSpareInstallationRecordsTable(pool);

    const [rows] = await pool.execute(
      `SELECT sir.*,
        rs.product_name AS rs_product_name,
        rs.customer_name AS rs_customer_name,
        sr.third_party_engineer_id,
        sr.assigned_to_type,
        sr.assigned_to_id
       FROM spare_installation_records sir
       LEFT JOIN registered_spares rs ON rs.id = sir.registered_spare_id
       LEFT JOIN service_records sr ON sr.service_id = sir.service_record_id
       ORDER BY sir.id DESC
       LIMIT ?`,
      [limit],
    );

    return NextResponse.json({ items: rows, total: rows.length });
  } catch (error) {
    console.error("GET /api/warranty/spare-installation:", error);
    return NextResponse.json(
      { items: [], total: 0, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  const token = req.cookies.get("token")?.value;
  let sessionUser = "unknown";
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    sessionUser = payload.username || sessionUser;
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      registered_spare_id,
      serial_number,
      order_id,
      quote_number,
      spare_item_code,
      spare_item_name,
      customer_name,
      installation_address,
      site_person,
      site_email,
      site_contact,
      username,
    } = body;

    if (
      !installation_address?.trim() ||
      !site_person?.trim() ||
      !site_email?.trim() ||
      !site_contact?.trim() ||
      !username?.trim()
    ) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const spareId = registered_spare_id
      ? parseInt(String(registered_spare_id), 10)
      : null;
    const serial = String(serial_number || "").trim() || null;

    const pool = await getDbConnection();
    await ensureSpareInstallationRecordsTable(pool);

    if (spareId) {
      const [exists] = await pool.execute(
        `SELECT id FROM spare_installation_records
         WHERE registered_spare_id = ? AND UPPER(status) <> 'COMPLETED'
         LIMIT 1`,
        [spareId],
      );
      if (exists.length > 0) {
        return NextResponse.json(
          { message: "Installation request already submitted for this spare" },
          { status: 409 },
        );
      }
    }

    let serviceRecordId = null;
    if (serial) {
      const [srResult] = await pool.execute(
        `INSERT INTO service_records
         (serial_number, service_type, complaint_date, complaint_summary, status, assigned_to)
         VALUES (?, 'INSTALLATION', CURDATE(), ?, 'PENDING', ?)`,
        [serial, "Scheduled for Installation (Spare)", username],
      );
      serviceRecordId = srResult.insertId;

      await pool.execute(
        `UPDATE warranty_products
         SET installed_address = ?, site_person = ?, site_contact = ?, site_email = ?
         WHERE TRIM(serial_number) = TRIM(?)`,
        [installation_address, site_person, site_contact, site_email, serial],
      );

      const [wpRows] = await pool.execute(
        `SELECT email, customer_name, product_name, model FROM warranty_products
         WHERE TRIM(serial_number) = TRIM(?) LIMIT 1`,
        [serial],
      );
      if (wpRows[0]?.email) {
        try {
          await sendTemplatedEmail(
            "INSTALLATION",
            {
              service_id: serviceRecordId,
              customer_name: wpRows[0].customer_name,
              product_name: wpRows[0].product_name,
              model: wpRows[0].model,
              serial_number: serial,
              site_person,
              site_email,
              site_contact,
              installation_address,
              service_type: "INSTALLATION",
              current_year: new Date().getFullYear(),
            },
            {
              to: wpRows[0].email,
              cc: "service@dynacleanindustries.com, dynacleanindustries@gmail.com",
              bcc: "piptrade3@gmail.com",
            },
          );
        } catch (emailErr) {
          console.error("Spare installation email:", emailErr);
        }
      }
    }

    const [ins] = await pool.execute(
      `INSERT INTO spare_installation_records (
        registered_spare_id, serial_number, order_id, quote_number,
        spare_item_code, spare_item_name, customer_name,
        installation_address, site_person, site_email, site_contact,
        assigned_to, status, service_record_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [
        spareId,
        serial,
        order_id || null,
        quote_number || null,
        spare_item_code || null,
        spare_item_name || null,
        customer_name || null,
        installation_address,
        site_person,
        site_email,
        site_contact,
        username,
        serviceRecordId,
        sessionUser,
      ],
    );

    if (spareId) {
      await pool.execute(
        `UPDATE registered_spares
         SET spare_installation_status = 'pending',
             customer_address = COALESCE(?, customer_address),
             updated_at = NOW()
         WHERE id = ?`,
        [installation_address, spareId],
      );
    }

    return NextResponse.json({
      message: "Installation request submitted successfully",
      id: ins.insertId,
      service_record_id: serviceRecordId,
    });
  } catch (error) {
    console.error("POST /api/warranty/spare-installation:", error);
    return NextResponse.json({ message: error.message || "Server error" }, { status: 500 });
  }
}