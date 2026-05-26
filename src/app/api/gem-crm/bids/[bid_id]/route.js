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

// GET - Get single bid by ID
export async function GET(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Handle async params in Next.js 15+
    const resolvedParams = await params;
    const bid_id = resolvedParams.bid_id;

    if (!bid_id) {
      return NextResponse.json({ error: "Bid ID is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const currentEmpId = await resolveGemCrmEmployeeId(conn, payload);

    // Build WHERE clause for filtering
    let whereClause = "WHERE b.bid_id = ?";
    let queryParams = [bid_id];

    // Only SUPERADMIN can see all bids, others can only see their own assigned bids
    if (payload.role !== "SUPERADMIN") {
      if (currentEmpId) {
        whereClause += " AND b.assigned_employee_id = ?";
        queryParams.push(currentEmpId);
      } else {
        // Fallback: try to get employee ID from username
        const username = payload?.username;
        if (username) {
          const [empRows] = await conn.execute(
            "SELECT empId FROM emplist WHERE LOWER(username) = LOWER(?) LIMIT 1",
            [username]
          );
          if (empRows?.[0]?.empId) {
            whereClause += " AND b.assigned_employee_id = ?";
            queryParams.push(empRows[0].empId);
          } else {
            const [repRows] = await conn.execute(
              "SELECT empId FROM rep_list WHERE LOWER(username) = LOWER(?) LIMIT 1",
              [username]
            );
            if (repRows?.[0]?.empId) {
              whereClause += " AND b.assigned_employee_id = ?";
              queryParams.push(repRows[0].empId);
            }
          }
        }
      }
    }

    // Get bid details with safe joins
    let bids = [];
    try {
      const [bidsResult] = await conn.execute(
        `SELECT b.*, 
          e.username as assigned_employee_name,
          e.empId as assigned_employee_empid,
          e.email as assigned_employee_email,
          dd.party_name as dd_party_name,
          dd.amount as dd_amount,
          dd.status as dd_status,
          dd.dd_number as dd_number,
          dd.bg_number as dd_bg_number
        FROM bids b
        LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
        LEFT JOIN dd_management dd ON b.dd_id = dd.id
        ${whereClause}`,
        queryParams
      );
      bids = bidsResult;
    } catch (e) {
      console.log("Bid details query with joins failed, trying with only emplist:", e.message);
      try {
        const [bidsResult] = await conn.execute(
          `SELECT b.*, 
            e.username as assigned_employee_name,
            e.empId as assigned_employee_empid,
            e.email as assigned_employee_email
          FROM bids b
          LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
          ${whereClause}`,
          queryParams
        );
        bids = bidsResult;
      } catch (e2) {
        console.log("Bid details query with emplist also failed, trying without joins:", e2.message);
        const [bidsResult] = await conn.execute(
          `SELECT b.*
          FROM bids b
          ${whereClause}`,
          queryParams
        );
        bids = bidsResult;
      }
    }

    if (bids.length === 0) {
      await conn.end();
      return NextResponse.json({ error: "Bid not found" }, { status: 404 });
    }

    // Get bid documents (safe query)
    let documents = [];
    try {
      const [docsResult] = await conn.execute(
        `SELECT bd.*, e.username as uploaded_by_name
         FROM bid_documents bd
         LEFT JOIN emplist e ON bd.uploaded_by = e.empId
         WHERE bd.bid_id = ?
         ORDER BY bd.created_at DESC`,
        [bid_id]
      );
      documents = docsResult;
    } catch (e) {
      console.log("Bid documents query failed, trying without emplist:", e.message);
      const [docsResult] = await conn.execute(
        `SELECT bd.*
         FROM bid_documents bd
         WHERE bd.bid_id = ?
         ORDER BY bd.created_at DESC`,
        [bid_id]
      );
      documents = docsResult;
    }

    // Get bid logs (safe query)
    let logs = [];
    try {
      const [logsResult] = await conn.execute(
        `SELECT bl.*, e.username as updated_by_name
         FROM bid_logs bl
         LEFT JOIN emplist e ON bl.updated_by = e.empId
         WHERE bl.bid_id = ?
         ORDER BY bl.created_at DESC`,
        [bid_id]
      );
      logs = logsResult;
    } catch (e) {
      console.log("Bid logs query failed, trying without emplist:", e.message);
      const [logsResult] = await conn.execute(
        `SELECT bl.*
         FROM bid_logs bl
         WHERE bl.bid_id = ?
         ORDER BY bl.created_at DESC`,
        [bid_id]
      );
      logs = logsResult;
    }

    await conn.end();

    return NextResponse.json({
      success: true,
      data: bids[0],
      documents,
      logs,
    });
  } catch (error) {
    console.error("Error fetching bid:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

// PUT - Update bid
export async function PUT(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Handle async params in Next.js 15+
    const resolvedParams = await params;
    const bid_id = resolvedParams.bid_id;

    if (!bid_id) {
      return NextResponse.json({ error: "Bid ID is required" }, { status: 400 });
    }
    const { fields, files } = await parseFormData(req);
    
    // Normalize field values
    for (const key in fields) {
      if (Array.isArray(fields[key])) {
        fields[key] = fields[key][0];
      }
    }

    const conn = await getDbConnection();
    const currentEmpId = await resolveGemCrmEmployeeId(conn, payload);

    // Build WHERE clause for filtering
    let whereClause = "WHERE bid_id = ?";
    let queryParams = [bid_id];

    // Only SUPERADMIN can update all bids, others can only update their own assigned bids
    if (payload.role !== "SUPERADMIN") {
      if (currentEmpId) {
        whereClause += " AND assigned_employee_id = ?";
        queryParams.push(currentEmpId);
      } else {
        // Fallback: try to get employee ID from username
        const username = payload?.username;
        if (username) {
          const [empRows] = await conn.execute(
            "SELECT empId FROM emplist WHERE LOWER(username) = LOWER(?) LIMIT 1",
            [username]
          );
          if (empRows?.[0]?.empId) {
            whereClause += " AND assigned_employee_id = ?";
            queryParams.push(empRows[0].empId);
          } else {
            const [repRows] = await conn.execute(
              "SELECT empId FROM rep_list WHERE LOWER(username) = LOWER(?) LIMIT 1",
              [username]
            );
            if (repRows?.[0]?.empId) {
              whereClause += " AND assigned_employee_id = ?";
              queryParams.push(repRows[0].empId);
            }
          }
        }
      }
    }

    // Get current bid to check for status change
    const [currentBids] = await conn.execute(
      `SELECT bid_status, bid_document FROM bids ${whereClause}`,
      queryParams
    );

    if (currentBids.length === 0) {
      await conn.end();
      return NextResponse.json({ error: "Bid not found" }, { status: 404 });
    }

    const currentBid = currentBids[0];

    // Ensure RA columns exist in database
    const columnsToCheck = [
      { name: 'ra_participated', type: 'ENUM("yes", "no") DEFAULT "no"' },
      { name: 'ra_start_date', type: 'DATE NULL' },
      { name: 'ra_end_date', type: 'DATE NULL' },
      { name: 'ra_last_price', type: 'DECIMAL(10,2) NULL' }
    ];

    const [tableInfo] = await conn.execute("DESCRIBE bids");
    const existingColumns = tableInfo.map(row => row.Field);

    for (const { name, type } of columnsToCheck) {
      if (!existingColumns.includes(name)) {
        try {
          await conn.execute(`ALTER TABLE bids ADD COLUMN ${name} ${type}`);
          console.log(`✅ Added column ${name} to bids table`);
        } catch (alterError) {
          console.error(`❌ Failed to add column ${name}:`, alterError.message);
        }
      }
    }

    // Handle bid document upload if provided
    let bid_document = fields.bid_document || currentBid.bid_document;
    if (files.bid_document && files.bid_document[0]) {
      // Delete old local file if it's a local path (PDFs)
      if (currentBid.bid_document && currentBid.bid_document.startsWith('/uploads/')) {
        const oldPath = path.join(process.cwd(), "public", currentBid.bid_document);
        await fs.unlink(oldPath).catch(() => {});
      }
      bid_document = await saveBidDocument(files.bid_document[0]);
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      'bidding_platform', 'bid_number', 'gem_bid_no', 'bid_title', 'bid_link',
      'bid_document', 'item_category', 'organisation_id', 'bid_start_date',
      'bid_end_date', 'bid_open_date', 'bid_validity_days', 'model_id',
      'specification', 'total_quantity', 'bid_type', 'evaluation_method',
      'estimated_bid_value', 'bid_value', 'emd_required', 'emd_amount', 'epbg_percentage',
      'epbg_duration_months', 'reverse_auction', 'turnover_required',
      'oem_turnover_required', 'experience_required_years', 'delivery_days',
      'inspection_required', 'technical_status', 'financial_status',
      'bid_status', 'assigned_employee_id', 'dd_id', 'remarks', 'ra_participated',
      'ra_start_date', 'ra_end_date', 'ra_last_price', 'order_id'
    ];

    for (const field of allowedFields) {
      if (payload.role !== "SUPERADMIN" && field === "assigned_employee_id") continue;
      if (fields[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(fields[field]);
      }
    }

    if (updateFields.length === 0) {
      await conn.end();
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updateValues.push(...queryParams);

    await conn.execute(
      `UPDATE bids SET ${updateFields.join(', ')} ${whereClause}`,
      updateValues
    );

    // Log status change if status changed
    if (fields.bid_status && fields.bid_status !== currentBid.bid_status) {
      await conn.execute(
        `INSERT INTO bid_logs (bid_id, old_status, new_status, remarks, updated_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          bid_id,
          currentBid.bid_status,
          fields.bid_status,
          fields.status_remarks || 'Status updated',
          payload.empId || payload.id || null,
        ]
      );

      // If bid status is "won", create order entry
      if (fields.bid_status === 'won') {
        await createOrderFromBid(conn, bid_id, payload);
      }
    }

    await conn.end();

    return NextResponse.json({
      success: true,
      message: "Bid updated successfully",
    });
  } catch (error) {
    console.error("Error updating bid:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

// DELETE - Delete bid
export async function DELETE(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Handle async params in Next.js 15+
    const resolvedParams = await params;
    const bid_id = resolvedParams.bid_id;

    if (!bid_id) {
      return NextResponse.json({ error: "Bid ID is required" }, { status: 400 });
    }
    const conn = await getDbConnection();
    const currentEmpId = await resolveGemCrmEmployeeId(conn, payload);

    // Build WHERE clause for filtering
    let whereClause = "WHERE bid_id = ?";
    let queryParams = [bid_id];

    // Only SUPERADMIN can delete all bids, others can only delete their own assigned bids
    if (payload.role !== "SUPERADMIN") {
      if (currentEmpId) {
        whereClause += " AND assigned_employee_id = ?";
        queryParams.push(currentEmpId);
      } else {
        // Fallback: try to get employee ID from username
        const username = payload?.username;
        if (username) {
          const [empRows] = await conn.execute(
            "SELECT empId FROM emplist WHERE LOWER(username) = LOWER(?) LIMIT 1",
            [username]
          );
          if (empRows?.[0]?.empId) {
            whereClause += " AND assigned_employee_id = ?";
            queryParams.push(empRows[0].empId);
          } else {
            const [repRows] = await conn.execute(
              "SELECT empId FROM rep_list WHERE LOWER(username) = LOWER(?) LIMIT 1",
              [username]
            );
            if (repRows?.[0]?.empId) {
              whereClause += " AND assigned_employee_id = ?";
              queryParams.push(repRows[0].empId);
            }
          }
        }
      }
    }

    // Get bid to delete document
    const [bids] = await conn.execute(
      `SELECT bid_document FROM bids ${whereClause}`,
      queryParams
    );
    if (bids.length === 0) {
      await conn.end();
      return NextResponse.json({ error: "Bid not found" }, { status: 404 });
    }

    // Delete local file if it's a local path (PDFs)
    if (bids.length > 0 && bids[0].bid_document && bids[0].bid_document.startsWith('/uploads/')) {
      const docPath = path.join(process.cwd(), "public", bids[0].bid_document);
      await fs.unlink(docPath).catch(() => {});
    }

    // Delete bid (cascade will delete documents and logs)
    await conn.execute(
      `DELETE FROM bids ${whereClause}`,
      queryParams
    );

    await conn.end();

    return NextResponse.json({
      success: true,
      message: "Bid deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting bid:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

// Helper function to create order from won bid
async function createOrderFromBid(conn, bidId, payload) {
  try {
    const [bids] = await conn.execute(
      "SELECT * FROM bids WHERE bid_id = ?",
      [bidId]
    );

    if (bids.length === 0) return;

    const bid = bids[0];

    // Check if order already exists for this bid
    const [existingOrders] = await conn.execute(
      "SELECT order_id FROM neworder WHERE bid_id = ?",
      [bidId]
    );

    if (existingOrders.length > 0) return;

    // Generate order ID
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const [orderCount] = await conn.execute(
      `SELECT COUNT(*) as count FROM neworder WHERE order_id LIKE ?`,
      [`${today}%`]
    );
    const orderId = today + String(orderCount[0].count + 1).padStart(3, "0");

    // Insert order
    await conn.execute(
      `INSERT INTO neworder (
        order_id, bid_id, bid_number, gem_bid_no, bidding_platform,
        client_name, phone, email, delivery_location, company_name,
        total_amount, approval_status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        bidId,
        bid.bid_number,
        bid.gem_bid_no,
        bid.bidding_platform,
        bid.bid_title || 'Government Bid',
        null,
        null,
        null,
        null,
        bid.estimated_bid_value || 0,
        'pending',
        payload.empId || payload.id || null,
      ]
    );

    console.log(`✅ Order created from bid ${bidId}: ${orderId}`);
  } catch (error) {
    console.error("Error creating order from bid:", error);
    // Don't throw - allow the bid update to succeed even if order creation fails
  }
}
