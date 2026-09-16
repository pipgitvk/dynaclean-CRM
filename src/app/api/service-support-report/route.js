// app/api/service-support-report/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { UNREGISTERED_PRODUCT_ORDER_SQL } from "@/lib/pendingProductRegistrationCount";

export async function GET(req) {
  const conn = await getDbConnection();

  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String(payload.role || payload.userRole || "");
    const roleNorm = role.toUpperCase().trim();

    // Only SUPERADMIN, DIRECTOR, SERVICE HEAD can view this report
    const allowed = ["SUPERADMIN", "DIRECTOR", "SERVICE HEAD", "EA"];
    if (!allowed.includes(roleNorm)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const employee = searchParams.get("employee") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Fetch all SERVICE SUPPORT employees
    const [empRows] = await conn.execute(
      `SELECT username FROM rep_list WHERE userRole = 'SERVICE SUPPORT' AND status = 1 ORDER BY username ASC`
    );
    const employees = empRows.map((r) => r.username);

    // Build employee filter
    const empFilter = employee !== "all" ? [employee] : employees;
    const empPlaceholders =
      empFilter.length > 0 ? empFilter.map(() => "?").join(",") : null;

    const emptySummary = {
      complaintsReceived: 0,
      complaintsResolved: 0,
      quotations: 0,
      ordersProcessed: 0,
      upcomingInstallations: 0,
      warrantyRegistered: 0,
      warrantyPending: 0,
    };

    let summary = { ...emptySummary };

    if (empFilter.length > 0 && empPlaceholders) {
      // 1) Complaints received
      const complaintReceivedConditions = [
        `sr.service_type = 'COMPLAINT'`,
        `sr.assigned_to IN (${empPlaceholders})`,
      ];
      const complaintReceivedParams = [...empFilter];
      if (startDate && endDate) {
        complaintReceivedConditions.push(
          `COALESCE(sr.complaint_date, sr.reg_date) BETWEEN ? AND ?`,
        );
        complaintReceivedParams.push(startDate, endDate);
      }
      const [complaintReceivedRows] = await conn.execute(
        `SELECT COUNT(*) AS count FROM service_records sr
         WHERE ${complaintReceivedConditions.join(" AND ")}`,
        complaintReceivedParams,
      );
      summary.complaintsReceived = Number(complaintReceivedRows[0]?.count ?? 0);

      // 2) Complaints resolved
      const complaintResolvedConditions = [
        `sr.service_type = 'COMPLAINT'`,
        `sr.status = 'COMPLETED'`,
        `sr.assigned_to IN (${empPlaceholders})`,
      ];
      const complaintResolvedParams = [...empFilter];
      if (startDate && endDate) {
        complaintResolvedConditions.push(`sr.completed_date BETWEEN ? AND ?`);
        complaintResolvedParams.push(startDate, endDate);
      }
      const [complaintResolvedRows] = await conn.execute(
        `SELECT COUNT(*) AS count FROM service_records sr
         WHERE ${complaintResolvedConditions.join(" AND ")}`,
        complaintResolvedParams,
      );
      summary.complaintsResolved = Number(complaintResolvedRows[0]?.count ?? 0);

      // 3) Quotations
      const quoteConditions = [`qr.emp_name IN (${empPlaceholders})`];
      const quoteParams = [...empFilter];
      if (startDate && endDate) {
        quoteConditions.push(`qr.created_at BETWEEN ? AND ?`);
        quoteParams.push(startDate, endDate);
      }
      const [quoteRows] = await conn.execute(
        `SELECT COUNT(*) AS count FROM quotations_records qr
         WHERE ${quoteConditions.join(" AND ")}`,
        quoteParams,
      );
      summary.quotations = Number(quoteRows[0]?.count ?? 0);

      // 4) Orders processed (service support orders in period)
      const orderConditions = [`no.created_by IN (${empPlaceholders})`];
      const orderParams = [...empFilter];
      if (startDate && endDate) {
        orderConditions.push(`no.created_at BETWEEN ? AND ?`);
        orderParams.push(startDate, endDate);
      }
      const [orderRows] = await conn.execute(
        `SELECT COUNT(*) AS count FROM neworder no
         WHERE ${orderConditions.join(" AND ")}`,
        orderParams,
      );
      summary.ordersProcessed = Number(orderRows[0]?.count ?? 0);

      // 5) Upcoming installations (pending install, dispatched, delivery in range)
      const installConditions = [
        `no.installation_status = 0`,
        `(no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)`,
        `(no.is_cancelled = 0 OR no.is_cancelled IS NULL)`,
        `no.delivery_date IS NOT NULL`,
        `no.dispatch_status = 1`,
        `no.created_by IN (${empPlaceholders})`,
        `EXISTS (
          SELECT 1 FROM dispatch d
          WHERE d.quote_number = no.quote_number
            AND d.serial_no IS NOT NULL AND d.serial_no <> ''
        )`,
      ];
      const installParams = [...empFilter];
      if (startDate && endDate) {
        installConditions.push(`no.delivery_date BETWEEN ? AND ?`);
        installParams.push(startDate, endDate);
      }
      const [installRows] = await conn.execute(
        `SELECT COUNT(DISTINCT no.id) AS count FROM neworder no
         WHERE ${installConditions.join(" AND ")}`,
        installParams,
      );
      summary.upcomingInstallations = Number(installRows[0]?.count ?? 0);

      // 6) Products registered in warranty
      const warrantyRegConditions = [`wp.created_by IN (${empPlaceholders})`];
      const warrantyRegParams = [...empFilter];
      if (startDate && endDate) {
        warrantyRegConditions.push(`wp.created_at BETWEEN ? AND ?`);
        warrantyRegParams.push(startDate, endDate);
      }
      const [warrantyRegRows] = await conn.execute(
        `SELECT COUNT(*) AS count FROM warranty_products wp
         WHERE ${warrantyRegConditions.join(" AND ")}`,
        warrantyRegParams,
      );
      summary.warrantyRegistered = Number(warrantyRegRows[0]?.count ?? 0);

      // 7) Products pending registration
      const pendingConditions = [
        `no.installation_status = 0`,
        `(no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)`,
        `(no.is_cancelled = 0 OR no.is_cancelled IS NULL)`,
        `no.delivery_date IS NOT NULL`,
        `no.dispatch_status = 1`,
        `no.created_by IN (${empPlaceholders})`,
        UNREGISTERED_PRODUCT_ORDER_SQL,
      ];
      const pendingParams = [...empFilter];
      const [pendingRows] = await conn.execute(
        `SELECT COUNT(DISTINCT no.id) AS count FROM neworder no
         WHERE ${pendingConditions.join(" AND ")}`,
        pendingParams,
      );
      summary.warrantyPending = Number(pendingRows[0]?.count ?? 0);
    }

    if (empFilter.length === 0) {
      return NextResponse.json({
        employees,
        summary,
        customerFollowups: [],
        machineFollowups: [],
      });
    }

    // ─── customers_followup (service followups) ───────────────────────────────
    let cfConditions = [`cf.followed_by IN (${empFilter.map(() => "?").join(",")})`];
    let cfParams = [...empFilter];

    if (startDate && endDate) {
      cfConditions.push(`cf.followed_date BETWEEN ? AND ?`);
      cfParams.push(startDate, endDate);
    }

    const [cfRows] = await conn.execute(
      `SELECT
         cf.s_no,
         cf.customer_id,
         c.first_name AS customer_name,
         c.phone AS customer_phone,
         cf.followed_by,
         cf.followed_date,
         cf.comm_mode,
         cf.notes,
         cf.purpose,
         cf.service_next_followup
       FROM customers_followup cf
       LEFT JOIN customers c ON c.customer_id = cf.customer_id
       WHERE ${cfConditions.join(" AND ")}
         AND cf.followed_by IS NOT NULL
         AND cf.followed_by != ''
       ORDER BY cf.followed_date DESC`,
      cfParams
    );

    // ─── machines_followup ────────────────────────────────────────────────────
    let mfConditions = [`mf.added_by IN (${empFilter.map(() => "?").join(",")})`];
    let mfParams = [...empFilter];

    if (startDate && endDate) {
      mfConditions.push(`mf.followed_at BETWEEN ? AND ?`);
      mfParams.push(startDate, endDate);
    }

    const [mfRows] = await conn.execute(
      `SELECT
         mf.id,
         mf.machine_id,
         mf.service_id,
         mf.serial_number,
         mf.product_model,
         mf.contact,
         mf.added_by,
         mf.followed_at,
         mf.next_followup_date,
         mf.notes,
         CASE
           WHEN open_sr.status IS NULL THEN 'Ok'
           ELSE open_sr.status
         END AS machine_status
       FROM machines_followup mf
       LEFT JOIN (
         SELECT
           TRIM(sr.serial_number) AS serial_key,
           sr.status
         FROM service_records sr
         INNER JOIN (
           SELECT TRIM(serial_number) AS serial_key, MAX(service_id) AS max_id
           FROM service_records
           WHERE UPPER(TRIM(COALESCE(status, ''))) <> 'COMPLETED'
           GROUP BY TRIM(serial_number)
         ) latest ON TRIM(sr.serial_number) = latest.serial_key AND sr.service_id = latest.max_id
       ) open_sr ON TRIM(mf.serial_number) = open_sr.serial_key
       WHERE ${mfConditions.join(" AND ")}
       ORDER BY mf.followed_at DESC`,
      mfParams
    );

    // Serialize dates
    const serializeDates = (rows) =>
      rows.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = v instanceof Date ? v.toISOString() : v;
        }
        return out;
      });

    return NextResponse.json({
      employees,
      summary,
      customerFollowups: serializeDates(cfRows),
      machineFollowups: serializeDates(mfRows),
    });
  } catch (error) {
    console.error("service-support-report error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
