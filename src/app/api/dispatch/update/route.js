import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { parseFormData } from "@/lib/parseForm";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "attachments");

async function savePhoto(file) {
  if (!file || !file.filepath || !file.originalFilename) return null;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${Date.now()}-${file.originalFilename}`;
  const targetPath = path.join(UPLOAD_DIR, fileName);
  const buf = await fs.readFile(file.filepath);
  await fs.writeFile(targetPath, buf);
  await fs.unlink(file.filepath).catch(() => {});
  return `/attachments/${fileName}`;
}

export async function POST(req) {
  try {
    const tokenPayload = await getSessionPayload();
    if (!tokenPayload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = tokenPayload.role;
    const username = tokenPayload.username;
    if (role !== "warehouse incharge" && role !== "WAREHOUSE INCHARGE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { fields, files } = await parseFormData(req);
    // Accept either specific row update by id, or batch by ids
    const id = Array.isArray(fields.id) ? fields.id[0] : fields.id;
    const serialNo = Array.isArray(fields.serial_no)
      ? fields.serial_no[0]
      : fields.serial_no;
    const remarks = Array.isArray(fields.remarks)
      ? fields.remarks[0]
      : fields.remarks;
    const godown = Array.isArray(fields.godown)
      ? fields.godown[0]
      : fields.godown; // required to know which location to deduct
    const accessoriesChecklist = Array.isArray(fields.accessories_checklist)
      ? fields.accessories_checklist[0]
      : fields.accessories_checklist;
    // Files: photos[] can be multiple
    const fileList = files.photos
      ? Array.isArray(files.photos)
        ? files.photos
        : [files.photos]
      : [];

    const photoUrls = [];
    for (const f of fileList) {
      const actual = Array.isArray(f) ? f[0] : f;
      const url = await savePhoto(actual);
      if (url) photoUrls.push(url);
    }

    if (!godown) {
      return NextResponse.json(
        { error: "Godown selection is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Retrieve previous photos and check if stock already deducted
    const [rows] = await conn.execute(
      `SELECT photos, stock_deducted FROM dispatch WHERE id = ?`,
      [id]
    );
    const prevPhotos =
      rows && rows[0] && rows[0].photos ? rows[0].photos : null;
    const stockAlreadyDeducted =
      rows && rows[0] && rows[0].stock_deducted === 1;

    let newPhotos = null;
    if (photoUrls.length) {
      if (prevPhotos) {
        newPhotos = prevPhotos + "," + photoUrls.join(",");
      } else {
        newPhotos = photoUrls.join(",");
      }
    } else {
      newPhotos = prevPhotos; // keep existing if none uploaded
    }

    // Fetch dispatch row to know what item to deduct and quote link
    const [dispatchRows] = await conn.execute(
      `SELECT id, quote_number, item_code, item_name, godown FROM dispatch WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!dispatchRows || !dispatchRows[0]) {
      return NextResponse.json(
        { error: "Dispatch row not found" },
        { status: 404 }
      );
    }

    const dispatchRow = dispatchRows[0];
    const quoteNumber = dispatchRow.quote_number;
    const itemCode = dispatchRow.item_code;

    const [orderRows] = await conn.execute(
      `SELECT id, order_id FROM neworder WHERE quote_number = ? LIMIT 1`,
      [quoteNumber]
    );

    const orderRow = orderRows[0];
    const orderNumber = orderRow.order_id;

    // STEP 1: Validate and update dispatch details FIRST (this checks serial_no uniqueness)
    // This ensures we don't deduct stock if there's a duplicate serial number error
    if (stockAlreadyDeducted) {
      // If stock already deducted, only update dispatch details
      await conn.execute(
        `UPDATE dispatch SET serial_no = ?, remarks = ?, photos = ?, accessories_checklist = ?, updated_at = NOW() WHERE id = ?`,
        [
          serialNo ?? null,
          remarks ?? null,
          newPhotos ?? null,
          accessoriesChecklist ?? null,
          id,
        ]
      );
      return NextResponse.json({
        success: true,
        note: "Stock already deducted, only updated dispatch details",
      });
    }

    // Update dispatch record (including godown) WITHOUT marking stock_deducted yet (validates serial_no uniqueness)
    await conn.execute(
      `UPDATE dispatch SET serial_no = ?, remarks = ?, photos = ?, godown = ?, accessories_checklist = ?, updated_at = NOW() WHERE id = ?`,
      [
        serialNo ?? null,
        remarks ?? null,
        newPhotos ?? null,
        godown ?? null,
        accessoriesChecklist ?? null,
        id,
      ]
    );

    // STEP 2: If we reach here, serial_no is valid. Now proceed with stock deduction
    // Determine item info from quotation
    // Note: Each dispatch row represents ONE item, so quantity is always 1
    const [itemRows] = await conn.execute(
      `SELECT item_code, total_price, hsn_sac FROM quotation_items WHERE quote_number = ? AND item_code = ?`,
      [quoteNumber, itemCode]
    );

    const [quoteMetaRows] = await conn.execute(
      `SELECT company_name, company_address, gstin FROM quotations_records WHERE quote_number = ?`,
      [quoteNumber]
    );

    if (!itemRows || !itemRows[0]) {
      return NextResponse.json({
        success: true,
        note: "No matching item to deduct",
      });
    }

    const { total_price, hsn_sac } = itemRows[0];
    const quantity = 1; // Each dispatch row is for ONE item
    const companyName =
      quoteMetaRows && quoteMetaRows[0] ? quoteMetaRows[0].company_name : null;
    const companyAddress =
      quoteMetaRows && quoteMetaRows[0]
        ? quoteMetaRows[0].company_address
        : null;
    const gstin =
      quoteMetaRows && quoteMetaRows[0] ? quoteMetaRows[0].gstin : null;

    const locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";

    // Reduce stock now based on whether item is product or spare
    const isProduct = /[a-zA-Z]/.test(itemCode);

    if (isProduct) {
      const [rows] = await conn.execute(
        `SELECT total, delhi, south FROM product_stock 
         WHERE product_code = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [itemCode]
      );

      let totalDB = 0;
      let delhiDB = 0;
      let southDB = 0;
      if (rows.length > 0) {
        totalDB = rows[0].total;
        delhiDB = rows[0].delhi;
        southDB = rows[0].south;
      }

      let delhiD = delhiDB;
      let southD = southDB;
      if (godown === "Delhi - Mundka") {
        delhiD = delhiDB - quantity;
        southD = southDB;
      } else {
        southD = southDB - quantity;
        delhiD = delhiDB;
      }
      const totalD = totalDB - quantity;

      await conn.execute(
        `INSERT INTO product_stock 
          (product_code, quantity, amount_per_unit, net_amount, note, location, stock_status, gst, hs_code, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemCode,
          quantity,
          total_price,
          total_price,
          "Dispatch Update",
          "Dispatch",
          "OUT",
          gstin,
          hsn_sac,
          companyName,
          companyAddress,
          quoteNumber,
          orderNumber,
          username,
          godown,
          totalD,
          delhiD,
          southD,
        ]
      );

      const [summary] = await conn.execute(
        `SELECT total_quantity, ${locationColumn} FROM product_stock_summary WHERE product_code = ?`,
        [itemCode]
      );
      if (summary.length > 0) {
        const prevTotal = summary[0].total_quantity;
        const newTotal = Math.max(prevTotal - quantity, 0);
        const prev = summary[0][locationColumn];
        const newv = Math.max(prev - quantity, 0);
        await conn.execute(
          `UPDATE product_stock_summary 
            SET last_updated_quantity = ?, total_quantity = ?, last_status = ?, updated_at = NOW(), ${locationColumn} = ?
            WHERE product_code = ?`,
          [quantity, newTotal, "OUT", newv, itemCode]
        );
      }
    } else {
      const [rows] = await conn.execute(
        `SELECT total, delhi, south FROM stock_list
         WHERE spare_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [itemCode]
      );

      let totalDB = 0;
      let delhiDB = 0;
      let southDB = 0;
      if (rows.length > 0) {
        totalDB = rows[0].total;
        delhiDB = rows[0].delhi;
        southDB = rows[0].south;
      }

      let delhiD = delhiDB;
      let southD = southDB;
      if (godown === "Delhi - Mundka") {
        delhiD = delhiDB - quantity;
        southD = southDB;
      } else {
        southD = southDB - quantity;
        delhiD = delhiDB;
      }
      const totalD = totalDB - quantity;

      await conn.execute(
        `INSERT INTO stock_list
          (spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemCode,
          quantity,
          total_price,
          total_price,
          "Dispatch Update",
          "Dispatch",
          "OUT",
          companyName,
          companyAddress,
          quoteNumber,
          orderNumber,
          username,
          godown,
          totalD,
          delhiD,
          southD,
        ]
      );

      const [summary] = await conn.execute(
        `SELECT total_quantity, ${locationColumn} FROM stock_summary WHERE spare_id = ?`,
        [itemCode]
      );
      if (summary.length > 0) {
        const prevTotal = summary[0].total_quantity;
        const newTotal = Math.max(prevTotal - quantity, 0);
        const prev = summary[0][locationColumn];
        const newv = Math.max(prev - quantity, 0);
        await conn.execute(
          `UPDATE stock_summary 
            SET last_updated_quantity = ?, total_quantity = ?, last_status = ?, updated_at = NOW(), ${locationColumn} = ?
            WHERE spare_id = ?`,
          [quantity, newTotal, "OUT", newv, itemCode]
        );
      }
    }

    // STEP 3: Mark stock as deducted (dispatch details already updated in STEP 1)
    await conn.execute(
      `UPDATE dispatch SET stock_deducted = 1, updated_at = NOW() WHERE id = ?`,
      [id]
    );

    // Send dispatch update email
    try {
      const { sendTemplatedEmail } = await import("@/lib/template-utils");

      // Fetch order details
      const [orderDetails] = await conn.execute(
        `SELECT order_id, quote_number, client_name, email, company_name, delivery_location, 
         booking_id, booking_url, dispatch_person 
         FROM neworder WHERE quote_number = ? LIMIT 1`,
        [quoteNumber]
      );

      if (orderDetails && orderDetails[0]) {
        const order = orderDetails[0];

        // Build item details HTML for this single item
        const itemDetailsHtml = `
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Item Name</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Item Code</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Serial Number</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Godown</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 12px; border: 1px solid #ddd;">${
                  dispatchRow.item_name || "N/A"
                }</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${
                  itemCode || "N/A"
                }</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${
                  serialNo || "N/A"
                }</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${
                  godown || "N/A"
                }</td>
              </tr>
            </tbody>
          </table>
        `;

        // Prepare template data
        const templateData = {
          order_id: order.order_id,
          quote_number: order.quote_number,
          customer_name: order.client_name,
          company_name: order.company_name,
          delivery_location: order.delivery_location,
          booking_id: order.booking_id || "N/A",
          booking_url: order.booking_url || "#",
          dispatch_person: order.dispatch_person || username,
          dispatch_date: new Date().toISOString().split("T")[0],
          item_details: itemDetailsHtml,
          current_year: new Date().getFullYear(),
        };

        // Send email
        const recipientEmail = order.email || "";
        if (recipientEmail) {
          await sendTemplatedEmail("DISPATCH", templateData, {
            to: recipientEmail,
            cc: "service@dynacleanindustries.com",
          });
        }
      }
    } catch (emailError) {
      console.error("Error sending dispatch update email:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Dispatch UPDATE error:", e);

    // Handle duplicate serial number error
    if (
      e.code === "ER_DUP_ENTRY" ||
      (e.message && e.message.includes("Duplicate entry"))
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Duplicate entry: This serial number is already in use. Please use a unique serial number.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
