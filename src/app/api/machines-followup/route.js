import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { uploadImage } from "../mediahandler";
import {
  isServiceSupportRole,
  sqlColumnInActiveServiceSupportUsers,
} from "@/lib/serviceSupportTeamScope";
import { canViewAllMachinesFollowupHistory } from "@/lib/dataScope";
import { fetchCustomerFollowupsByContact } from "@/lib/customerFollowupByContact";
import { SERVICE_RECORD_FOLLOWUP_STATUS_OPTIONS } from "@/lib/serviceRecordStatusPermissions";

const FOLLOWUP_STATUS_VALUES = new Set(
  SERVICE_RECORD_FOLLOWUP_STATUS_OPTIONS.map((s) => String(s).trim().toUpperCase()),
);

let machinesFollowupStatusColumnReady = false;

async function ensureMachinesFollowupStatusColumn(pool) {
  if (machinesFollowupStatusColumnReady) return;
  const [cols] = await pool.execute(`SHOW COLUMNS FROM machines_followup LIKE 'status'`);
  if (!cols?.length) {
    await pool.execute(
      `ALTER TABLE machines_followup ADD COLUMN status VARCHAR(64) NULL`,
    );
  }
  machinesFollowupStatusColumnReady = true;
}

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page       = parseInt(searchParams.get("page")  || "1");
    const limit      = parseInt(searchParams.get("limit") || "50");
    const search     = searchParams.get("search")      || "";
    const serial     = searchParams.get("serial")      || "";   // history mode
    const includeCustomerFollowups = searchParams.get("customer_followups") === "1";
    const contact    = searchParams.get("contact")     || "";
    const email      = searchParams.get("email")       || "";
    const latestOnly = searchParams.get("latest_only") === "1"; // one row per serial
    const offset     = (page - 1) * limit;

    const username     = payload.username || "unknown";
    const role         = payload.role || payload.userRole || "";
    const roleUpper    = String(role).toUpperCase();
    const isSuperAdmin = roleUpper === "SUPERADMIN" || roleUpper === "DIRECTOR";
    const isEA         = roleUpper === "EA";
    const isServiceSupport = isServiceSupportRole(role);
    const canViewAllHistory = canViewAllMachinesFollowupHistory(role);

    const pool = await getDbConnection();

    /* ── HISTORY MODE: all rows for one serial number ── */
    if (serial) {
      const hCond   = [];
      const hParams = [];
      hCond.push("serial_number = ?");
      hParams.push(serial);

      if (includeCustomerFollowups) {
        hCond.push(`EXISTS (
          SELECT 1 FROM rep_list r
          WHERE r.username = machines_followup.added_by
            AND UPPER(TRIM(r.userRole)) = 'SERVICE SUPPORT'
        )`);
      } else if (!canViewAllHistory) {
        if (isServiceSupport) {
          hCond.push(sqlColumnInActiveServiceSupportUsers("added_by"));
        } else {
          hCond.push("added_by = ?");
          hParams.push(username);
        }
      }

      const [histRows] = await pool.execute(
        `SELECT * FROM machines_followup WHERE ${hCond.join(" AND ")} ORDER BY id DESC`,
        hParams
      );

      let customerHistory = [];
      if (includeCustomerFollowups) {
        try {
          let lookupContact = contact;
          let lookupEmail = email;
          if (!lookupContact || !lookupEmail) {
            const [wpRows] = await pool.execute(
              `SELECT contact, email FROM warranty_products
               WHERE TRIM(serial_number) = TRIM(?)
               LIMIT 1`,
              [serial]
            );
            lookupContact = lookupContact || wpRows[0]?.contact || "";
            lookupEmail = lookupEmail || wpRows[0]?.email || "";
          }
          customerHistory = await fetchCustomerFollowupsByContact(pool, lookupContact, lookupEmail, {
            serviceSupportOnly: true,
          });
        } catch (err) {
          console.error("Error fetching customer followups for history:", err);
        }
      }

      return NextResponse.json({ success: true, history: histRows, customerHistory });
    }

    /* ── build WHERE for both modes (no mf. alias needed inside subquery) ── */
    const cond   = [];
    const params = [];
    if (!canViewAllHistory) {
      if (isServiceSupport) {
        cond.push(sqlColumnInActiveServiceSupportUsers("added_by"));
      } else {
        cond.push("added_by = ?");
        params.push(username);
      }
    }
    if (search) {
      const s = `%${search}%`;
      cond.push("(serial_number LIKE ? OR product_model LIKE ? OR added_by LIKE ? OR notes LIKE ? OR contact LIKE ? OR CAST(machine_id AS CHAR) LIKE ? OR CAST(service_id AS CHAR) LIKE ?)");
      params.push(s, s, s, s, s, s, s);
    }
    const innerWhere = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

    /* ── LATEST-ONLY MODE: one row per serial_number ── */
    if (latestOnly) {
      const [allRows] = await pool.execute(
        `SELECT mf.*
         FROM machines_followup mf
         INNER JOIN (
           SELECT serial_number, MAX(id) AS max_id
           FROM machines_followup
           ${innerWhere}
           GROUP BY serial_number
         ) latest ON mf.serial_number = latest.serial_number AND mf.id = latest.max_id
         ORDER BY mf.id DESC`,
        params
      );
      const total      = allRows.length;
      const totalPages = Math.ceil(total / limit);
      return NextResponse.json({
        success: true,
        followups: allRows.slice(offset, offset + limit),
        total, totalPages, currentPage: page, pageSize: limit
      });
    }

    /* ── NORMAL PAGINATED MODE ── */
    const mfCond   = cond.map(c => c.replace(/\b(serial_number|product_model|added_by|notes|contact|machine_id|service_id)\b/g, "mf.$1"));
    const mfWhere  = mfCond.length ? `WHERE ${mfCond.join(" AND ")}` : "";

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM machines_followup mf ${mfWhere}`, params
    );
    const totalPages = Math.ceil(total / limit);
    const [rows] = await pool.execute(
      `SELECT * FROM machines_followup mf ${mfWhere} ORDER BY mf.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return NextResponse.json({ success: true, followups: rows, total, totalPages, currentPage: page, pageSize: limit });

  } catch (error) {
    console.error("Error fetching machines followups:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch followups" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const username = payload.username || "unknown";

    const formData = await req.formData();
    const serialNumber = formData.get("serial_number");
    const productModel = formData.get("product_model");
    const machineIdRaw = formData.get("machine_id");
    const serviceIdRaw = formData.get("service_id");
    const notes = formData.get("notes");
    const nextFollowupDate = formData.get("next_followup_date");
    const imageFile = formData.get("image");
    const followedAt = formData.get("followed_at");
    const contact = formData.get("contact");
    const statusRaw = String(formData.get("status") || "").trim();
    const statusUpper = statusRaw.toUpperCase();
    if (!statusRaw) {
      return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 });
    }
    if (statusUpper && !FOLLOWUP_STATUS_VALUES.has(statusUpper) && statusUpper.length > 64) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    // Validate followed_at is within last 24 hours (Asia/Kolkata timezone)
    const now = new Date();
    // Get current time in IST
    const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const oneDayAgoIST = new Date(nowIST.getTime() - 24 * 60 * 60 * 1000);
    let followedDate;
    if (followedAt) {
      // Parse datetime-local string as IST time
      const [year, month, day, hours, minutes] = followedAt.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/).slice(1);
      followedDate = new Date(year, month - 1, day, hours, minutes);
    } else {
      followedDate = nowIST;
    }
    
    // Convert followedDate to IST for comparison
    const followedDateIST = new Date(followedDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    if (followedDate < oneDayAgoIST || followedDate > nowIST) {
      return NextResponse.json({ success: false, error: "Follow-up date must be within the last 24 hours" }, { status: 400 });
    }

    // Validate next_followup_date is mandatory
    if (!nextFollowupDate) {
      return NextResponse.json({ success: false, error: "Next follow-up date is mandatory" }, { status: 400 });
    }

    const nextFollowupMatch = String(nextFollowupDate).match(
      /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
    );
    const nextFollowupParsed = nextFollowupMatch
      ? new Date(
          Number(nextFollowupMatch[1]),
          Number(nextFollowupMatch[2]) - 1,
          Number(nextFollowupMatch[3]),
          Number(nextFollowupMatch[4]),
          Number(nextFollowupMatch[5]),
        )
      : null;
    if (nextFollowupParsed && followedDate && nextFollowupParsed < followedDate) {
      return NextResponse.json(
        { success: false, error: "Next follow-up date cannot be before followed date" },
        { status: 400 },
      );
    }

    let imageUrl = null;
    if (imageFile && imageFile.name) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      imageUrl = await uploadImage({
        data: buffer,
        name: imageFile.name,
        mimetype: imageFile.type
      }, "machines-followup");
    }

    const pool = await getDbConnection();
    await ensureMachinesFollowupStatusColumn(pool);

    let machineId = machineIdRaw != null && String(machineIdRaw).trim() !== ""
      ? parseInt(machineIdRaw, 10)
      : NaN;
    if (!Number.isFinite(machineId) && serialNumber) {
      const [wpRows] = await pool.execute(
        `SELECT id FROM warranty_products WHERE serial_number = ? ORDER BY id ASC LIMIT 1`,
        [serialNumber]
      );
      machineId = wpRows[0]?.id ?? null;
    } else if (!Number.isFinite(machineId)) {
      machineId = null;
    }

    let serviceId = serviceIdRaw != null && String(serviceIdRaw).trim() !== ""
      ? parseInt(serviceIdRaw, 10)
      : NaN;
    if (!Number.isFinite(serviceId) && serialNumber) {
      const [srRows] = await pool.execute(
        `SELECT service_id FROM service_records
         WHERE TRIM(serial_number) = TRIM(?)
         ORDER BY service_id DESC LIMIT 1`,
        [serialNumber]
      );
      serviceId = srRows[0]?.service_id ?? null;
    } else if (!Number.isFinite(serviceId)) {
      serviceId = null;
    }

    const sql = `INSERT INTO machines_followup 
      (machine_id, service_id, serial_number, product_model, notes, next_followup_date, added_by, image, followed_at, contact, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      machineId,
      serviceId,
      serialNumber,
      productModel,
      notes || null,
      nextFollowupDate,
      username,
      imageUrl,
      followedDate,
      contact || null,
      statusRaw,
    ];

    await pool.execute(sql, values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating machines followup:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create followup" }, { status: 500 });
  }
}

// API to search for serial numbers (for autocomplete)
export async function PUT(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { search } = await req.json();
    if (!search) {
      return NextResponse.json({ success: true, products: [] });
    }

    const pool = await getDbConnection();
    const searchTerm = `%${search}%`;
    const [rows] = await pool.execute(
      `SELECT id, serial_number, model, product_name, email, contact 
       FROM warranty_products 
       WHERE serial_number LIKE ? OR model LIKE ? OR CAST(id AS CHAR) LIKE ?
       LIMIT 10`,
      [searchTerm, searchTerm, searchTerm]
    );

    return NextResponse.json({ success: true, products: rows });
  } catch (error) {
    console.error("Error searching serial numbers:", error);
    return NextResponse.json({ success: false, error: "Failed to search products" }, { status: 500 });
  }
}
