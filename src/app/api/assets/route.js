// src/app/api/assets/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import path from 'path';
import fs from 'fs/promises';

const UPLOAD_DIR = path.join(process.cwd(), "public", "asset_attachments");

// --- POST route to save a NEW asset ---
export async function POST(request) {
  let conn = null;
  try {
    const formData = await request.formData();

    const saveFile = async (file, namePrefix) => {
      if (!file || typeof file === 'string' || !file.size) return null;
      const fileName = `${formData.get('assetTagNumber') || 'accessory'}-${namePrefix}-${Date.now()}${path.extname(file.name)}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      console.log(`✅ File saved locally: ${filePath}`);
      return `/asset_attachments/${fileName}`;
    };

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Handle all file uploads first
    const invoiceAttachment = formData.get('invoiceAttachment');
    const warrantyCard = formData.get('warrantyCard');
    const userManual = formData.get('userManual');
    const assetPhotos = formData.getAll('assetPhotos');
    
    const invoiceAttachmentPath = await saveFile(invoiceAttachment, 'invoice');
    const warrantyCardPath = await saveFile(warrantyCard, 'warranty');
    const userManualPath = await saveFile(userManual, 'manual');
    
    const assetPhotosPaths = await Promise.all(
      assetPhotos.map(photo => saveFile(photo, 'photo'))
    );
    const photosPathsJson = JSON.stringify(assetPhotosPaths.filter(Boolean));

    conn = await getDbConnection();

    const fields = Object.fromEntries(formData.entries());

    // Normalize/prepare complex fields
    const assetCategory = fields.assetCategory || null;
    const isSimAccessory = (fields.assetType === 'Accessory' && assetCategory === 'SIM');
    const todayStr = new Date().toISOString().split('T')[0];
    const valueOr = (val, fallback) => (val === undefined || val === '' ? fallback : val);
    const checklist = fields.checklist ? fields.checklist : null; // accept JSON string
    const technicalSpecs = fields.technical_specs ? fields.technical_specs : null; // JSON string
    const loginCredentials = fields.login_credentials ? fields.login_credentials : null; // JSON string

    await conn.execute(
      `INSERT INTO assets (
        type, asset_category, asset_tag_number, asset_name, brand_name, model_name, serial_number, color, asset_condition,
        purchase_date, purchased_from, purchase_price, invoice_number, warranty_period,
        associated_email, email_password, device_password, phone_number,
        invoice_attachment_path, warranty_card_path, user_manual_path, asset_photos_paths,
        note,
        sim_no_1, sim_no_2, provider_1, provider_2, imei_no_1, imei_no_2, login_gmails, login_gmail_password, device_lock_password,
        whatsapp_no_normal, whatsapp_no_business, backup_gmail_normal, backup_gmail_business, google_contact_gmail, checklist,
        technical_specs,
        sim_plan, sim_billing_cycle, sim_billing_type, accessory_type, capacity, imei_or_serial, network_provider, network_speed_plan, login_credentials
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        valueOr(fields.assetType, isSimAccessory ? 'Accessory' : null),
        assetCategory,
        fields.assetTagNumber || null,
        valueOr(fields.assetName, isSimAccessory ? 'SIM' : null),
        valueOr(fields.brandName, isSimAccessory ? 'SIM' : null),
        fields.modelName || null,
        fields.serialNumber || null,
        fields.color || null,
        valueOr(fields.assetCondition, isSimAccessory ? 'New' : null),
        valueOr(fields.purchaseDate, isSimAccessory ? todayStr : null),
        valueOr(fields.purchasedFrom, isSimAccessory ? 'N/A' : null),
        valueOr(fields.purchasePrice, isSimAccessory ? 0 : null),
        valueOr(fields.invoiceNumber, isSimAccessory ? 'N/A' : null),
        valueOr(fields.warrantyPeriod, isSimAccessory ? 'N/A' : null),
        fields.associatedEmail || null,
        fields.emailPassword || null,
        fields.devicePassword || null,
        fields.phoneNumber || null,
        invoiceAttachmentPath || null,
        warrantyCardPath || null,
        userManualPath || null,
        photosPathsJson || JSON.stringify([]),
        fields.note || null,
        fields.sim_no_1 || null,
        fields.sim_no_2 || null,
        fields.provider_1 || null,
        fields.provider_2 || null,
        fields.imei_no_1 || null,
        fields.imei_no_2 || null,
        fields.login_gmails || null,
        fields.login_gmail_password || null,
        fields.device_lock_password || null,
        fields.whatsapp_no_normal || null,
        fields.whatsapp_no_business || null,
        fields.backup_gmail_normal || null,
        fields.backup_gmail_business || null,
        fields.google_contact_gmail || null,
        checklist,
        technicalSpecs,
        fields.sim_plan || null,
        fields.sim_billing_cycle || null,
        fields.sim_billing_type || null,
        fields.accessory_type || null,
        fields.capacity || null,
        fields.imei_or_serial || null,
        fields.network_provider || null,
        fields.network_speed_plan || null,
        loginCredentials,
      ]
    );
    
        // await conn.end();
    console.log(`✅ Asset ${fields.assetTagNumber || fields.assetName} successfully submitted to database.`);
    return NextResponse.json({ success: true, message: 'Asset saved successfully' });
  } catch (err) {
    console.error("❌ Asset submission error:", err);
    if (conn)     // await conn.end();
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


export async function GET(request) {
  let conn = null;
  try {
    conn = await getDbConnection();
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status'); // 'assigned' | 'available' | null

    // Latest assignment per asset (if any)
    const latestAssignmentCte = `
      SELECT t1.*
      FROM asset_assignments t1
      JOIN (
        SELECT asset_id, MAX(created_at) AS max_created
        FROM asset_assignments
        GROUP BY asset_id
      ) t2 ON t1.asset_id = t2.asset_id AND t1.created_at = t2.max_created
    `;

    let baseQuery = `
      SELECT a.*, la.Assigned_to, la.Assigned_by, la.Assigned_Date, la.is_submit, la.submit_date, la.receipt_path,
             la.status AS current_status
      FROM assets a
      LEFT JOIN (${latestAssignmentCte}) la ON la.asset_id = a.asset_id
    `;

    const whereClauses = [];
    const params = [];

    if (statusFilter === 'assigned') {
      whereClauses.push(`la.status = 'Assigned'`);
    } else if (statusFilter === 'available') {
      whereClauses.push(`(la.assignment_id IS NULL OR la.status = 'Returned')`);
    }

    if (whereClauses.length) {
      baseQuery += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    baseQuery += ` ORDER BY a.created_at DESC`;

    const [rows] = await conn.execute(baseQuery, params);

    console.log(rows);
    
    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ Error fetching assets:", err);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  } finally {
    if (conn) {
          // await conn.end();
    }
  }
}