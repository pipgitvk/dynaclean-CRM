import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { uploadImage } from "../mediahandler";

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
    const latestOnly = searchParams.get("latest_only") === "1"; // one row per serial
    const offset     = (page - 1) * limit;

    const username     = payload.username || "unknown";
    const role         = (payload.role || payload.userRole || "").toUpperCase();
    const isSuperAdmin = role === "SUPERADMIN";
    const isEA         = role === "EA"; // Add EA role check

    const pool = await getDbConnection();

    /* ── HISTORY MODE: all rows for one serial number ── */
    if (serial) {
      const hCond   = [];
      const hParams = [];
      if (!isSuperAdmin && !isEA) { hCond.push("added_by = ?"); hParams.push(username); } // EA sees all
      hCond.push("serial_number = ?"); hParams.push(serial);

      const [histRows] = await pool.execute(
        `SELECT * FROM machines_followup WHERE ${hCond.join(" AND ")} ORDER BY id DESC`,
        hParams
      );
      return NextResponse.json({ success: true, history: histRows });
    }

    /* ── build WHERE for both modes (no mf. alias needed inside subquery) ── */
    const cond   = [];
    const params = [];
    if (!isSuperAdmin && !isEA) { cond.push("added_by = ?");   params.push(username); } // EA sees all
    if (search) {
      const s = `%${search}%`;
      cond.push("(serial_number LIKE ? OR product_model LIKE ? OR added_by LIKE ? OR notes LIKE ? OR contact LIKE ?)");
      params.push(s, s, s, s, s);
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
    const mfCond   = cond.map(c => c.replace(/\b(serial_number|product_model|added_by|notes|contact)\b/g, "mf.$1"));
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
    const notes = formData.get("notes");
    const nextFollowupDate = formData.get("next_followup_date");
    const imageFile = formData.get("image");
    const followedAt = formData.get("followed_at");
    const contact = formData.get("contact");

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
    const sql = `INSERT INTO machines_followup 
      (serial_number, product_model, notes, next_followup_date, added_by, image, followed_at, contact) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      serialNumber,
      productModel,
      notes || null,
      nextFollowupDate,
      username,
      imageUrl,
      followedDate,
      contact || null
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
      `SELECT serial_number, model, product_name, email, contact 
       FROM warranty_products 
       WHERE serial_number LIKE ? OR model LIKE ?
       LIMIT 10`,
      [searchTerm, searchTerm]
    );

    return NextResponse.json({ success: true, products: rows });
  } catch (error) {
    console.error("Error searching serial numbers:", error);
    return NextResponse.json({ success: false, error: "Failed to search products" }, { status: 500 });
  }
}
