// src/app/api/assets/[asset_id]/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "receipts");
const SUBMIT_REPORT_DIR = path.join(process.cwd(), "public", "submit_reports");

export async function PATCH(request, { params }) {
  const { asset_id } = params;
  let conn = null;

  try {
    const contentType = request.headers.get("content-type");
    let action;
    let data = {};

    if (contentType?.includes("multipart/form-data")) {
      const formData = await request.formData();
      action = formData.get("action");
      if (action === "upload-receipt") {
        data.receiptFile = formData.get("receipt");
      } else if (action === "upload-submit-report") {
        data.submitReportFile = formData.get("submit_report");
      }
    } else if (contentType?.includes("application/json")) {
      data = await request.json();
      action = data.action;
    } else {
      return NextResponse.json(
        { error: "Unsupported Content-Type" },
        { status: 415 }
      );
    }

    conn = await getDbConnection();

    if (action === "assign") {
      await conn.execute(
        `INSERT INTO asset_assignments (asset_id, Assigned_to, Assigned_by, Assigned_Date, is_submit, status) VALUES (?, ?, ?, ?, ?, 'Assigned')`,
        [asset_id, data.Assigned_to, data.Assigned_by, new Date(), false]
      );
          // await conn.end();
      return NextResponse.json({
        success: true,
        message: "Asset assigned successfully",
      });
    } else if (action === "return") {
      const submitDate = data.submit_date ? new Date(data.submit_date) : new Date();
      const notes = data.notes || null;
      // Mark the latest open assignment as returned
      await conn.execute(
        `UPDATE asset_assignments
         SET status = 'Returned', submit_date = ?, notes = ?
         WHERE assignment_id = (
           SELECT assignment_id FROM (
             SELECT assignment_id
             FROM asset_assignments
             WHERE asset_id = ? AND status = 'Assigned'
             ORDER BY created_at DESC
             LIMIT 1
           ) as t
         )`,
        [submitDate, notes, asset_id]
      );
      return NextResponse.json({ success: true, message: "Asset returned" });
    } else if (action === "edit-assignment") {
      const { assignment_id, Assigned_to, Assigned_by, Assigned_Date, notes, status } = data;
      if (!assignment_id) {
        return NextResponse.json({ error: "assignment_id is required" }, { status: 400 });
      }
      const fields = [];
      const params = [];
      if (Assigned_to !== undefined) { fields.push('Assigned_to = ?'); params.push(Assigned_to); }
      if (Assigned_by !== undefined) { fields.push('Assigned_by = ?'); params.push(Assigned_by); }
      if (Assigned_Date !== undefined) { fields.push('Assigned_Date = ?'); params.push(new Date(Assigned_Date)); }
      if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
      if (status !== undefined) { fields.push('status = ?'); params.push(status); }
      if (!fields.length) {
        return NextResponse.json({ success: true, message: "No changes" });
      }
      params.push(assignment_id);
      await conn.execute(
        `UPDATE asset_assignments SET ${fields.join(', ')} WHERE assignment_id = ?`,
        params
      );
      return NextResponse.json({ success: true, message: "Assignment updated" });
    } else if (action === "upload-receipt") {
      const receiptFile = data.receiptFile;

      if (!receiptFile || typeof receiptFile === "string") {
            // await conn.end();
        return NextResponse.json(
          { error: "No receipt file provided." },
          { status: 400 }
        );
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const fileName = `${asset_id}-receipt-${Date.now()}${path.extname(
        receiptFile.name
      )}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      const buffer = Buffer.from(await receiptFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      const receiptPath = `/receipts/${fileName}`;

      await conn.execute(
        `UPDATE asset_assignments
         SET receipt_path = ?
         WHERE assignment_id = (
           SELECT assignment_id
           FROM (
             SELECT assignment_id
             FROM asset_assignments
             WHERE asset_id = ? AND receipt_path IS NULL
             ORDER BY assigned_date DESC
             LIMIT 1
           ) AS temp
         )`,
        [receiptPath, asset_id]
      );

          // await conn.end();
      return NextResponse.json({
        success: true,
        message: "Receipt uploaded successfully.",
        path: receiptPath,
      });
    } else if (action === "upload-submit-report") {
      const submitReportFile = data.submitReportFile;

      if (!submitReportFile || typeof submitReportFile === "string") {
            // await conn.end();
        return NextResponse.json(
          { error: "No submission report file provided." },
          { status: 400 }
        );
      }

      await fs.mkdir(SUBMIT_REPORT_DIR, { recursive: true });
      const fileName = `${asset_id}-submit-report-${Date.now()}${path.extname(
        submitReportFile.name
      )}`;
      const filePath = path.join(SUBMIT_REPORT_DIR, fileName);
      const buffer = Buffer.from(await submitReportFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      const submitReportPath = `/submit_reports/${fileName}`;

      // Update the most recent assignment with the report path and set is_submit to TRUE
      await conn.execute(
        `UPDATE asset_assignments
         SET submit_report_path = ?, is_submit = TRUE, submit_date = ?, status = 'Returned'
         WHERE assignment_id = (
           SELECT assignment_id
           FROM (
             SELECT assignment_id
             FROM asset_assignments
             WHERE asset_id = ? AND receipt_path IS NOT NULL AND is_submit = FALSE
             ORDER BY assigned_date DESC
             LIMIT 1
           ) AS temp
         )`,
        [submitReportPath, new Date(), asset_id]
      );
      
          // await conn.end();
      return NextResponse.json({
        success: true,
        message: "Asset submitted successfully.",
        path: submitReportPath,
      });
    } else if (action === 'edit') {
      // Build dynamic update across common + category-specific fields
      const allowedFields = [
        // Common
        'asset_name','brand_name','model_name','serial_number','color','note',
        'purchase_date','purchased_from','purchase_price','invoice_number','warranty_period',
        // Credentials/common device
        'associated_email','email_password','device_password','phone_number',
        // Mobile
        'sim_no_1','sim_no_2','provider_1','provider_2','imei_no_1','imei_no_2','login_gmails','login_gmail_password','device_lock_password',
        'whatsapp_no_normal','whatsapp_no_business','backup_gmail_normal','backup_gmail_business','google_contact_gmail','checklist',
        // SIM Accessory
        'sim_plan','sim_billing_cycle','sim_billing_type',
        // Other Accessories
        'accessory_type','capacity',
        // Router/Dongle
        'imei_or_serial','network_provider','network_speed_plan','login_credentials',
        // Technical JSON
        'technical_specs'
      ];
      const sets = [];
      const params = [];
      for (const key of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          let value = data[key];
          // Normalize JSON columns: allow object or valid JSON string, otherwise NULL
          if (['checklist','technical_specs','login_credentials'].includes(key)) {
            if (value === '' || value === undefined) {
              value = null;
            } else if (typeof value === 'object') {
              try { value = JSON.stringify(value); } catch { value = null; }
            } else if (typeof value === 'string') {
              const trimmed = value.trim();
              if (!trimmed) {
                value = null;
              } else {
                try { JSON.parse(trimmed); value = trimmed; } catch { value = null; }
              }
            }
          }
          sets.push(`${key} = ?`);
          params.push(value);
        }
      }
      if (sets.length === 0) {
        return NextResponse.json({ success: true, message: 'No changes' });
      }
      params.push(asset_id);
      await conn.execute(`UPDATE assets SET ${sets.join(', ')} WHERE asset_id = ?`, params);
          // await conn.end();
      return NextResponse.json({ success: true, message: "Asset updated successfully" });
    }

        // await conn.end();
    return NextResponse.json({ success: true, message: "No action performed." });

  } catch (err) {
    console.error("❌ Error patching asset:", err);
    if (conn)     // await conn.end();
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  const { asset_id } = params;
  let conn = null;
  try {
    const url = new URL(request.url);
    const fetch = url.searchParams.get('fetch');
    conn = await getDbConnection();
    if (fetch === 'assignments') {
      const [rows] = await conn.execute(
        `SELECT assignment_id, asset_id, Assigned_to, Assigned_by, Assigned_Date, is_submit, receipt_path, submit_report_path, submit_date, status, notes, created_at
         FROM asset_assignments
         WHERE asset_id = ?
         ORDER BY created_at DESC`,
        [asset_id]
      );
      return NextResponse.json(rows);
    }
    return NextResponse.json({ error: 'Invalid fetch parameter' }, { status: 400 });
  } catch (err) {
    console.error('❌ Error fetching asset resource:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    if (conn) {
      // await conn.end();
    }
  }
}