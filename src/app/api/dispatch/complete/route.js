import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = payload.role;
    const roleUpperComplete = String(role).toUpperCase();
    if (!["WAREHOUSE INCHARGE", "ADMIN", "SUPERADMIN", "DIRECTOR", "TEAM LEADER"].includes(roleUpperComplete)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const orderId = body.order_id;
    if (!orderId) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });

    const conn = await getDbConnection();

    // Find quote number for this order
    const [orderRows] = await conn.execute(
      `SELECT quote_number FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId]
    );
    if (!orderRows || !orderRows[0] || !orderRows[0].quote_number) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const quoteNumber = orderRows[0].quote_number;

    // Block completion until all PRODUCT dispatch rows have serial numbers filled
    // Products are identified by item_code containing at least one alphabet character;
    // spares (purely numeric codes) are allowed to have empty serial numbers.
    const [dispatchRows] = await conn.execute(
      `SELECT item_code, serial_no, godown FROM dispatch WHERE quote_number = ?`,
      [quoteNumber]
    );

    const pendingProductSerials = dispatchRows.filter((row) => {
      const itemCode = row.item_code || "";
      const isProduct = /[a-zA-Z]/.test(itemCode);
      if (!isProduct) return false; // spare item – serial not mandatory
      const serial = row.serial_no || "";
      return serial.trim() === ""; // product without serial => pending
    }).length;

    if (pendingProductSerials > 0) {
      return NextResponse.json(
        { success: false, error: "Please fill serial numbers for all product items before completing dispatch." },
        { status: 400 }
      );
    }

    const dispatchPerson = payload.username || payload.name || null;

    await conn.execute(
      `UPDATE neworder SET dispatch_status = 1, dispatch_person = ? WHERE order_id = ?`,
      [dispatchPerson, orderId]
    );

    // ✅ Deduct spare stock: insert OUT entry in stock_list and update stock_summary
    // Spare items have item_codes that are NOT product item_codes (alphanumeric product codes).
    // We identify spares by trying to resolve them in spare_list.
    // Products have item_codes with letters (e.g. DSC-30); spares use spare_number (e.g. S-001) or numeric ids.
    const spareDispatchRows = dispatchRows.filter((row) => {
      const itemCode = row.item_code || "";
      return itemCode.trim() !== "";
    });

    if (spareDispatchRows.length > 0) {
      // Group by (item_code, godown) to batch deductions
      const spareGroups = {};
      for (const row of spareDispatchRows) {
        const itemCode = row.item_code.trim();
        const godown = row.godown || "";
        const key = `${itemCode}__${godown}`;
        if (!spareGroups[key]) {
          spareGroups[key] = { itemCode, godown, count: 0 };
        }
        spareGroups[key].count += 1;
      }

      for (const { itemCode, godown, count } of Object.values(spareGroups)) {
        // Resolve item_code (could be spare_number string or numeric id) → spare_list.id
        const [spareMatch] = await conn.execute(
          `SELECT id FROM spare_list WHERE spare_number = ? OR CAST(id AS CHAR) = ? LIMIT 1`,
          [itemCode, itemCode]
        );
        if (!spareMatch || spareMatch.length === 0) {
          console.warn(`⚠️ spare not found in spare_list for item_code=${itemCode}, skipping stock deduction`);
          continue;
        }
        const spareId = spareMatch[0].id;
        const isDelhi = godown === "Delhi - Mundka";

        // Fetch latest stock_list snapshot for running totals
        const [lastRows] = await conn.execute(
          `SELECT total, delhi, south FROM stock_list WHERE spare_id = ? ORDER BY created_at DESC LIMIT 1`,
          [spareId]
        );
        const last = lastRows[0] || { total: 0, delhi: 0, south: 0 };

        const newTotal = Math.max(0, Number(last.total || 0) - count);
        const newDelhi = isDelhi ? Math.max(0, Number(last.delhi || 0) - count) : Number(last.delhi || 0);
        const newSouth = !isDelhi ? Math.max(0, Number(last.south || 0) - count) : Number(last.south || 0);

        await conn.execute(
          `INSERT INTO stock_list (spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, added_date, from_company, supporting_file, added_by, godown, total, Delhi, South, godown_location)
           VALUES (?, ?, NULL, NULL, ?, NULL, 'OUT', NOW(), NULL, NULL, ?, ?, ?, ?, ?, ?)`,
          [spareId, count, `Dispatch order #${orderId}`, dispatchPerson, godown, newTotal, newDelhi, newSouth, godown]
        );

        // Update stock_summary
        const [summaryRows] = await conn.execute(
          `SELECT total_quantity, Delhi, South FROM stock_summary WHERE spare_id = ?`,
          [spareId]
        );
        if (summaryRows.length > 0) {
          const sum = summaryRows[0];
          const sumTotal = Math.max(0, Number(sum.total_quantity || 0) - count);
          const sumDelhi = isDelhi ? Math.max(0, Number(sum.Delhi || 0) - count) : Number(sum.Delhi || 0);
          const sumSouth = !isDelhi ? Math.max(0, Number(sum.South || 0) - count) : Number(sum.South || 0);
          await conn.execute(
            `UPDATE stock_summary SET last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?, last_status = 'OUT', updated_at = NOW() WHERE spare_id = ?`,
            [count, sumTotal, sumDelhi, sumSouth, spareId]
          );
        }

        console.log(`✅ Spare id=${spareId} (code=${itemCode}) stock deducted: qty=${count}, godown=${godown}, newTotal=${newTotal}`);
      }
    }

    // Send dispatch completion email
    try {
      const { sendTemplatedEmail } = await import('@/lib/template-utils');

      // Fetch order details
      const [orderDetails] = await conn.execute(
        `SELECT order_id, quote_number, client_name, email, company_name, delivery_location, 
         booking_id, booking_url, dispatch_person, created_at 
         FROM neworder WHERE order_id = ? LIMIT 1`,
        [orderId]
      );

      if (orderDetails && orderDetails[0]) {
        const order = orderDetails[0];

        // Fetch dispatch items
        const [dispatchItems] = await conn.execute(
          `SELECT item_name, item_code, serial_no FROM dispatch WHERE quote_number = ?`,
          [quoteNumber]
        );

        // Build item details HTML table
        let itemDetailsHtml = `
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Item Name</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Item Code</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Serial Number</th>
              </tr>
            </thead>
            <tbody>
        `;

        dispatchItems.forEach(item => {
          itemDetailsHtml += `
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;">${item.item_name || 'N/A'}</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${item.item_code || 'N/A'}</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${item.serial_no || 'N/A'}</td>
            </tr>
          `;
        });

        itemDetailsHtml += `
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
          booking_id: order.booking_id || 'N/A',
          booking_url: order.booking_url || '#',
          dispatch_person: order.dispatch_person || dispatchPerson,
          dispatch_date: new Date().toISOString().split('T')[0],
          item_details: itemDetailsHtml,
          current_year: new Date().getFullYear(),
        };

        // Send email
        const recipientEmail = order.email || '';
        if (recipientEmail) {
          await sendTemplatedEmail(
            'DISPATCH',
            templateData,
            {
              to: recipientEmail,
              cc: 'service@dynacleanindustries.com',
            }
          );
        }
      }
    } catch (emailError) {
      console.error('Error sending dispatch completion email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Dispatch complete error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

