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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const username = payload.username || "unknown";
    const role = (payload.role || payload.userRole || "").toUpperCase();
    const isSuperAdmin = role === "SUPERADMIN";

    const pool = await getDbConnection();

    const conditions = [];
    const params = [];

    // Only superadmin sees all, others see only their own
    if (!isSuperAdmin) {
      conditions.push(`mf.added_by = ?`);
      params.push(username);
    }

    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(`(
        mf.serial_number LIKE ? OR
        mf.product_model LIKE ? OR
        mf.added_by LIKE ? OR
        mf.notes LIKE ? OR
        mf.contact LIKE ?
      )`);
      params.push(...Array(5).fill(searchTerm));
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM machines_followup mf
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get paginated data
    const [rows] = await pool.execute(
      `SELECT *
       FROM machines_followup mf
       ${whereClause}
       ORDER BY mf.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      followups: rows,
      total,
      totalPages,
      currentPage: page,
      pageSize: limit
    });
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

    // Validate followed_at is within last 24 hours (local timezone)
    const now = new Date();
    let followedDate;
    if (followedAt) {
      // Parse datetime-local string as local time
      const [year, month, day, hours, minutes] = followedAt.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/).slice(1);
      followedDate = new Date(year, month - 1, day, hours, minutes);
    } else {
      followedDate = now;
    }
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (followedDate < oneDayAgo || followedDate > now) {
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
      `SELECT serial_number, model, product_name 
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
