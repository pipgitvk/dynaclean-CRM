import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { parseFormData } from "@/lib/parseForm";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bid-documents");

// Helper function to check if file is an image
function isImageFile(file) {
  const fileName = file.originalFilename || file.newFilename || "";
  const mimeType = file.mimetype || "";
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const extension = fileName.toLowerCase().split('.').pop();
  return mimeType.startsWith('image/') || imageExtensions.includes(`.${extension}`);
}

// Helper function to save bid document (images to Cloudinary, PDFs locally)
async function saveBidDocument(file) {
  if (!file || !file.filepath || !file.originalFilename) {
    throw new Error("File is missing or invalid");
  }

  // If it's an image, upload to Cloudinary
  if (isImageFile(file)) {
    const buffer = await fs.readFile(file.filepath);
    
    const upload = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: 'bid-documents',
          resource_type: "auto"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      ).end(buffer);
    });
    
    console.log("✅ Bid image uploaded to Cloudinary:", upload);
    return upload;
  }

  // For PDFs and other documents, save locally
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${Date.now()}-${file.originalFilename}`;
  const targetPath = path.join(UPLOAD_DIR, fileName);

  try {
    const fileContent = await fs.readFile(file.filepath);
    await fs.writeFile(targetPath, fileContent);
    console.log("✅ Bid document saved locally:", targetPath);
    return `/uploads/bid-documents/${fileName}`;
  } finally {
    await fs.unlink(file.filepath).catch((err) => {
      console.error("Failed to delete temp file:", err);
    });
  }
}

// GET - List all bids with pagination, search, and filters
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const technicalStatus = searchParams.get("technicalStatus") || "";
    const financialStatus = searchParams.get("financialStatus") || "";
    const platform = searchParams.get("platform") || "";
    const employeeId = searchParams.get("employeeId") || "";
    const organisationId = searchParams.get("organisationId") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    const offset = (page - 1) * limit;
    const conn = await getDbConnection();
    const currentEmpId = await resolveGemCrmEmployeeId(conn, payload);

    console.log("DEBUG: User Info", {
      username: payload?.username,
      role: payload?.role,
      empId: payload?.empId,
      id: payload?.id,
      resolvedEmpId: currentEmpId
    });

    // Build WHERE clause
    const conditions = [];
    const params = [];

    // Only SUPERADMIN can see all bids, others can only see their own assigned bids
    if (payload.role !== "SUPERADMIN") {
      // Try to filter by employee ID first
      if (currentEmpId) {
        console.log("DEBUG: Using resolved employee ID:", currentEmpId);
        conditions.push("assigned_employee_id = ?");
        params.push(currentEmpId);
      } else {
        // Fallback: try to get employee ID from username
        const username = payload?.username;
        console.log("DEBUG: Trying to resolve employee ID from username:", username);
        if (username) {
          const [empRows] = await conn.execute(
            "SELECT empId FROM emplist WHERE LOWER(username) = LOWER(?) LIMIT 1",
            [username]
          );
          if (empRows?.[0]?.empId) {
            console.log("DEBUG: Found employee ID in emplist:", empRows[0].empId);
            conditions.push("assigned_employee_id = ?");
            params.push(empRows[0].empId);
          } else {
            const [repRows] = await conn.execute(
              "SELECT empId FROM rep_list WHERE LOWER(username) = LOWER(?) LIMIT 1",
              [username]
            );
            if (repRows?.[0]?.empId) {
              console.log("DEBUG: Found employee ID in rep_list:", repRows[0].empId);
              conditions.push("assigned_employee_id = ?");
              params.push(repRows[0].empId);
            } else {
              console.log("DEBUG: Employee ID not found for username:", username);
            }
          }
        }
      }
    }

    if (search) {
      conditions.push(
        "(bid_number LIKE ? OR gem_bid_no LIKE ? OR bid_title LIKE ?)"
      );
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (status) {
      conditions.push("bid_status = ?");
      params.push(status);
    }

    if (technicalStatus) {
      conditions.push("technical_status = ?");
      params.push(technicalStatus);
    }

    if (financialStatus) {
      conditions.push("financial_status = ?");
      params.push(financialStatus);
    }

    if (platform) {
      conditions.push("bidding_platform = ?");
      params.push(platform);
    }

    if (employeeId && payload.role === "SUPERADMIN") {
      conditions.push("assigned_employee_id = ?");
      params.push(employeeId);
    }

    if (organisationId) {
      conditions.push("organisation_id = ?");
      params.push(organisationId);
    }

    if (dateFrom) {
      conditions.push("bid_start_date >= ?");
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push("bid_end_date <= ?");
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 
      ? "WHERE " + conditions.join(" AND ") 
      : "";

    // Get total count
    const [countRows] = await conn.execute(
      `SELECT COUNT(*) as total FROM bids ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // Get bids with employee name (safe query - try without dd_management first)
    let bids = [];
    try {
      const [bidsResult] = await conn.execute(
        `SELECT b.*, 
          COALESCE(r.username, e.username, CONCAT('Employee #', b.assigned_employee_id)) as assigned_employee_name,
          b.assigned_employee_id as assigned_employee_empid,
          dd.party_name as dd_party_name,
          dd.amount as dd_amount,
          dd.status as dd_status
        FROM bids b
        LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
        LEFT JOIN rep_list r ON b.assigned_employee_id = r.empId
        LEFT JOIN dd_management dd ON b.dd_id = dd.id
        ${whereClause}
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      bids = bidsResult;
    } catch (e) {
      console.log("Bids query with dd_management failed, trying without:", e.message);
      // Fallback query without dd_management
      const [bidsResult] = await conn.execute(
        `SELECT b.*, 
          COALESCE(r.username, e.username, CONCAT('Employee #', b.assigned_employee_id)) as assigned_employee_name,
          b.assigned_employee_id as assigned_employee_empid
        FROM bids b
        LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
        LEFT JOIN rep_list r ON b.assigned_employee_id = r.empId
        ${whereClause}
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      bids = bidsResult;
    }

    await conn.end();

    return NextResponse.json({
      success: true,
      data: bids,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bids:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

// POST - Create new bid
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { fields, files } = await parseFormData(req);
    
    // Normalize field values
    for (const key in fields) {
      if (Array.isArray(fields[key])) {
        fields[key] = fields[key][0];
      }
    }

    const {
      bidding_platform,
      bid_number,
      gem_bid_no,
      bid_title,
      bid_link,
      item_category,
      organisation_id,
      bid_start_date,
      bid_end_date,
      bid_open_date,
      bid_validity_days,
      model_id,
      specification,
      total_quantity,
      bid_type,
      evaluation_method,
      estimated_bid_value,
      emd_required,
      emd_amount,
      epbg_percentage,
      epbg_duration_months,
      reverse_auction,
      turnover_required,
      oem_turnover_required,
      experience_required_years,
      delivery_days,
      inspection_required,
      assigned_employee_id,
      dd_id,
      remarks,
    } = fields;

    // Handle bid document upload
    let bid_document = null;
    if (files.bid_document && files.bid_document[0]) {
      bid_document = await saveBidDocument(files.bid_document[0]);
    }

    const conn = await getDbConnection();
    const currentEmpId = await resolveGemCrmEmployeeId(conn, payload);
    if (payload.role === "GEM" && !currentEmpId) {
      await conn.end();
      return NextResponse.json({ error: "Employee id missing in session." }, { status: 403 });
    }

    const [result] = await conn.execute(
      `INSERT INTO bids (
        bidding_platform, bid_number, gem_bid_no, bid_title, bid_link, bid_document,
        item_category, organisation_id, bid_start_date, bid_end_date, bid_open_date,
        bid_validity_days, model_id, specification, total_quantity, bid_type,
        evaluation_method, estimated_bid_value, emd_required, emd_amount,
        epbg_percentage, epbg_duration_months, reverse_auction, turnover_required,
        oem_turnover_required, experience_required_years, delivery_days,
        inspection_required, assigned_employee_id, dd_id, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bidding_platform || null,
        bid_number || null,
        gem_bid_no || null,
        bid_title || null,
        bid_link || null,
        bid_document,
        item_category || null,
        organisation_id || null,
        bid_start_date || null,
        bid_end_date || null,
        bid_open_date || null,
        bid_validity_days || null,
        model_id || null,
        specification || null,
        total_quantity || null,
        bid_type || null,
        evaluation_method || null,
        estimated_bid_value || null,
        emd_required || 'no',
        emd_amount || null,
        epbg_percentage || null,
        epbg_duration_months || null,
        reverse_auction || 'no',
        turnover_required || null,
        oem_turnover_required || null,
        experience_required_years || null,
        delivery_days || null,
        inspection_required || 'no',
        payload.role === "GEM" ? currentEmpId : assigned_employee_id || null,
        dd_id || null,
        remarks || null,
        payload.empId || payload.id || null,
      ]
    );

    // Log initial status
    await conn.execute(
      `INSERT INTO bid_logs (bid_id, old_status, new_status, remarks, updated_by)
       VALUES (?, NULL, 'new', 'Bid created', ?)`,
      [result.insertId, payload.empId || payload.id || null]
    );

    await conn.end();

    return NextResponse.json({
      success: true,
      message: "Bid created successfully",
      bid_id: result.insertId,
    });
  } catch (error) {
    console.error("Error creating bid:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
