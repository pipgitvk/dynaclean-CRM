// app/api/service-support-report/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { UNREGISTERED_PRODUCT_ORDER_SQL } from "@/lib/pendingProductRegistrationCount";

const KPI_DETAIL_TYPES = new Set([
  "complaintsReceived",
  "complaintsResolved",
  "quotations",
  "ordersProcessed",
  "upcomingInstallations",
  "warrantyRegistered",
  "warrantyPending",
]);

function serializeRows(rows) {
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v instanceof Date ? v.toISOString() : v;
    }
    return out;
  });
}

/** Complaints received: service_records with type COMPLAINT and a complaint_date. */
function buildComplaintReceivedFilter(startDate, endDate) {
  const conditions = [
    `UPPER(TRIM(sr.service_type)) = 'COMPLAINT'`,
    `sr.complaint_date IS NOT NULL`,
  ];
  const params = [];
  if (startDate && endDate) {
    conditions.push(`sr.complaint_date BETWEEN ? AND ?`);
    params.push(startDate, endDate);
  }
  return { conditions, params };
}

/** Complaints resolved: received complaints whose status is COMPLETED. */
function buildComplaintResolvedFilter(startDate, endDate) {
  const { conditions, params } = buildComplaintReceivedFilter(startDate, endDate);
  conditions.push(`UPPER(TRIM(sr.status)) = 'COMPLETED'`);
  return { conditions, params };
}

async function fetchKpiDetails(conn, detailType, empFilter, startDate, endDate) {
  const needsEmpFilter = !["complaintsReceived", "complaintsResolved"].includes(detailType);
  if (needsEmpFilter && !empFilter.length) return [];

  const empPlaceholders = empFilter.map(() => "?").join(",");

  switch (detailType) {
    case "complaintsReceived": {
      const { conditions, params } = buildComplaintReceivedFilter(startDate, endDate);
      const [rows] = await conn.execute(
        `SELECT
           sr.service_id,
           sr.serial_number,
           sr.service_type,
           sr.assigned_to,
           sr.status,
           sr.complaint_summary,
           sr.complaint_date,
           sr.completed_date,
           wp.customer_name,
           wp.contact
         FROM service_records sr
         LEFT JOIN warranty_products wp
           ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
         WHERE ${conditions.join(" AND ")}
         ORDER BY sr.complaint_date DESC`,
        params,
      );
      return rows;
    }

    case "complaintsResolved": {
      const { conditions, params } = buildComplaintResolvedFilter(startDate, endDate);
      const [rows] = await conn.execute(
        `SELECT
           sr.service_id,
           sr.serial_number,
           sr.service_type,
           sr.assigned_to,
           sr.status,
           sr.complaint_summary,
           sr.complaint_date,
           sr.completed_date,
           wp.customer_name,
           wp.contact
         FROM service_records sr
         LEFT JOIN warranty_products wp
           ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
         WHERE ${conditions.join(" AND ")}
         ORDER BY sr.complaint_date DESC`,
        params,
      );
      return rows;
    }

    case "quotations": {
      const conditions = [`qr.emp_name IN (${empPlaceholders})`];
      const params = [...empFilter];
      if (startDate && endDate) {
        conditions.push(`qr.created_at BETWEEN ? AND ?`);
        params.push(startDate, endDate);
      }
      const [rows] = await conn.execute(
        `SELECT
           qr.quote_number,
           qr.quote_date,
           qr.created_at,
           qr.customer_id,
           qr.company_name,
           qr.emp_name,
           qr.grand_total
         FROM quotations_records qr
         WHERE ${conditions.join(" AND ")}
         ORDER BY qr.created_at DESC`,
        params,
      );
      return rows;
    }

    case "ordersProcessed": {
      const conditions = [`no.created_by IN (${empPlaceholders})`];
      const params = [...empFilter];
      if (startDate && endDate) {
        conditions.push(`no.created_at BETWEEN ? AND ?`);
        params.push(startDate, endDate);
      }
      const [rows] = await conn.execute(
        `SELECT
           no.order_id,
           no.client_name,
           no.contact,
           no.quote_number,
           no.created_by,
           no.created_at,
           no.totalamt,
           no.approval_status
         FROM neworder no
         WHERE ${conditions.join(" AND ")}
         ORDER BY no.created_at DESC`,
        params,
      );
      return rows;
    }

    case "upcomingInstallations": {
      const conditions = [
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
      const params = [...empFilter];
      if (startDate && endDate) {
        conditions.push(`no.delivery_date BETWEEN ? AND ?`);
        params.push(startDate, endDate);
      }
      const [rows] = await conn.execute(
        `SELECT DISTINCT
           no.order_id,
           no.quote_number,
           no.client_name,
           no.company_name,
           no.contact,
           no.created_by,
           no.delivery_date,
           no.installation_status
         FROM neworder no
         WHERE ${conditions.join(" AND ")}
         ORDER BY no.delivery_date ASC`,
        params,
      );
      return rows;
    }

    case "warrantyRegistered": {
      const conditions = [`wp.created_by IN (${empPlaceholders})`];
      const params = [...empFilter];
      if (startDate && endDate) {
        conditions.push(`wp.created_at BETWEEN ? AND ?`);
        params.push(startDate, endDate);
      }
      const [rows] = await conn.execute(
        `SELECT
           wp.id,
           wp.serial_number,
           wp.customer_name,
           wp.product_name,
           wp.model,
           wp.contact,
           wp.created_by,
           wp.created_at
         FROM warranty_products wp
         WHERE ${conditions.join(" AND ")}
         ORDER BY wp.created_at DESC`,
        params,
      );
      return rows;
    }

    case "warrantyPending": {
      const conditions = [
        `no.installation_status = 0`,
        `(no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)`,
        `(no.is_cancelled = 0 OR no.is_cancelled IS NULL)`,
        `no.delivery_date IS NOT NULL`,
        `no.dispatch_status = 1`,
        `no.created_by IN (${empPlaceholders})`,
        UNREGISTERED_PRODUCT_ORDER_SQL,
      ];
      const params = [...empFilter];
      const [rows] = await conn.execute(
        `SELECT DISTINCT
           no.order_id,
           no.quote_number,
           no.client_name,
           no.company_name,
           no.contact,
           no.created_by,
           no.delivery_date
         FROM neworder no
         WHERE ${conditions.join(" AND ")}
         ORDER BY no.delivery_date ASC`,
        params,
      );
      return rows;
    }

    default:
      return [];
  }
}

async function attachMachineStatus(conn, rows) {
  if (!rows.length) return rows;

  const serialKeys = [
    ...new Set(
      rows
        .map((row) => String(row.serial_number || "").trim())
        .filter(Boolean),
    ),
  ];

  const statusBySerial = {};

  if (serialKeys.length > 0) {
    const placeholders = serialKeys.map(() => "?").join(", ");
    const [openServices] = await conn.execute(
      `SELECT service_id, serial_number, status
       FROM service_records
       WHERE TRIM(serial_number) IN (${placeholders})
         AND UPPER(TRIM(COALESCE(status, ''))) <> 'COMPLETED'
       ORDER BY service_id DESC`,
      serialKeys,
    );

    for (const service of openServices) {
      const key = String(service.serial_number || "").trim();
      if (key && !statusBySerial[key]) {
        statusBySerial[key] = service.status;
      }
    }
  }

  return rows.map((row) => {
    const key = String(row.serial_number || "").trim();
    return {
      ...row,
      machine_status: key && statusBySerial[key] ? statusBySerial[key] : "Ok",
    };
  });
}

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
    const detailType = searchParams.get("detailType");

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

    // 1–2) Complaints from service_records (all complaints in period, not filtered by SERVICE SUPPORT assignee)
    const receivedFilter = buildComplaintReceivedFilter(startDate, endDate);
    const [complaintReceivedRows] = await conn.execute(
      `SELECT COUNT(*) AS count FROM service_records sr
       WHERE ${receivedFilter.conditions.join(" AND ")}`,
      receivedFilter.params,
    );
    summary.complaintsReceived = Number(complaintReceivedRows[0]?.count ?? 0);

    const resolvedFilter = buildComplaintResolvedFilter(startDate, endDate);
    const [complaintResolvedRows] = await conn.execute(
      `SELECT COUNT(*) AS count FROM service_records sr
       WHERE ${resolvedFilter.conditions.join(" AND ")}`,
      resolvedFilter.params,
    );
    summary.complaintsResolved = Number(complaintResolvedRows[0]?.count ?? 0);

    if (empFilter.length > 0 && empPlaceholders) {
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

    if (detailType) {
      if (!KPI_DETAIL_TYPES.has(detailType)) {
        return NextResponse.json({ error: "Invalid detailType" }, { status: 400 });
      }
      const details = serializeRows(
        await fetchKpiDetails(conn, detailType, empFilter, startDate, endDate),
      );
      return NextResponse.json({ details });
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

    const [mfRowsRaw] = await conn.execute(
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
         mf.notes
       FROM machines_followup mf
       WHERE ${mfConditions.join(" AND ")}
       ORDER BY mf.followed_at DESC`,
      mfParams
    );

    const mfRows = await attachMachineStatus(conn, mfRowsRaw);

    return NextResponse.json({
      employees,
      summary,
      customerFollowups: serializeRows(cfRows),
      machineFollowups: serializeRows(mfRows),
    });
  } catch (error) {
    console.error("service-support-report error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data", details: error.message },
      { status: 500 },
    );
  }
}
