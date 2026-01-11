import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const tokenPayload = await getSessionPayload();
    if (!tokenPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { order_id, action, items_to_return } = await req.json();

    if (!order_id || !action) {
      return NextResponse.json({ error: "order_id and action are required" }, { status: 400 });
    }

    if (!["INSTALLED", "RETURNED", "PARTIAL_RETURN"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Validate items_to_return for PARTIAL_RETURN action
    if (action === "PARTIAL_RETURN") {
      if (!items_to_return || !Array.isArray(items_to_return) || items_to_return.length === 0) {
        return NextResponse.json({ error: "items_to_return array is required for partial returns" }, { status: 400 });
      }
    }

    const conn = await getDbConnection();

    // Fetch order row
    const [orderRows] = await conn.execute(
      `SELECT id, order_id, quote_number, company_name, company_address, installation_status, is_returned
       FROM neworder WHERE order_id = ? LIMIT 1`,
      [order_id]
    );

    if (!orderRows || !orderRows[0]) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderRow = orderRows[0];

    if (action === "INSTALLED") {
      await conn.execute(
        `UPDATE neworder SET installation_status = 1 WHERE order_id = ?`,
        [order_id]
      );

      return NextResponse.json({ success: true, message: "Installation marked as completed" });
    }

    // PARTIAL_RETURN logic
    if (action === "PARTIAL_RETURN") {
      const quoteNumber = orderRow.quote_number;
      if (!quoteNumber) {
        return NextResponse.json({ error: "Quote number not found for this order" }, { status: 400 });
      }

      const username = tokenPayload.username || null;
      const companyName = orderRow.company_name || null;
      const companyAddress = orderRow.company_address || null;

      let returnedCount = 0;

      for (const item of items_to_return) {
        const { dispatch_id, reason } = item;

        if (!dispatch_id) continue;

        // Get dispatch details
        const [dispatchRows] = await conn.execute(
          `SELECT id, item_code, item_name, stock_deducted, godown FROM dispatch WHERE id = ?`,
          [dispatch_id]
        );

        if (!dispatchRows || !dispatchRows[0]) continue;
        const dispatchRow = dispatchRows[0];

        // Skip if already returned (stock_deducted = 0)
        if (dispatchRow.stock_deducted !== 1) continue;

        const itemCode = dispatchRow.item_code;
        const itemName = dispatchRow.item_name;
        const godown = dispatchRow.godown;

        // Insert into order_return_items
        await conn.execute(
          `INSERT INTO order_return_items 
           (order_id, dispatch_id, item_code, item_name, quantity_returned, return_reason, returned_by, godown, stock_reversed)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, 1)`,
          [order_id, dispatch_id, itemCode, itemName, reason || null, username, godown]
        );

        // Reverse stock (same logic as full return)
        const quantity = 1;
        const locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";
        const isProduct = /[a-zA-Z]/.test(itemCode);

        if (isProduct) {
          // Product stock reversal
          const [rows] = await conn.execute(
            `SELECT total, delhi, south FROM product_stock
             WHERE product_code = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [itemCode]
          );

          let totalDB = 0, delhiDB = 0, southDB = 0;
          if (rows.length > 0) {
            totalDB = rows[0].total || 0;
            delhiDB = rows[0].delhi || 0;
            southDB = rows[0].south || 0;
          }

          let delhiD = delhiDB, southD = southDB;
          if (godown === "Delhi - Mundka") {
            delhiD = delhiDB + quantity;
          } else {
            southD = southDB + quantity;
          }
          const totalD = totalDB + quantity;

          await conn.execute(
            `INSERT INTO product_stock
              (product_code, quantity, amount_per_unit, net_amount, note, location, stock_status, gst, hs_code, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
              VALUES (?, ?, NULL, NULL, ?, ?, 'IN', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [itemCode, quantity, "Partial Return", "Partial Return", companyName, companyAddress, quoteNumber, order_id, username, godown, totalD, delhiD, southD]
          );

          const [summary] = await conn.execute(
            `SELECT total_quantity, ${locationColumn} FROM product_stock_summary WHERE product_code = ?`,
            [itemCode]
          );
          if (summary.length > 0) {
            const prevTotal = summary[0].total_quantity || 0;
            const prev = summary[0][locationColumn] || 0;
            const newTotal = prevTotal + quantity;
            const newv = prev + quantity;
            await conn.execute(
              `UPDATE product_stock_summary
                SET last_updated_quantity = ?, total_quantity = ?, last_status = 'IN', updated_at = NOW(), ${locationColumn} = ?
                WHERE product_code = ?`,
              [quantity, newTotal, newv, itemCode]
            );
          }
        } else {
          // Spare stock reversal
          const [rows] = await conn.execute(
            `SELECT total, delhi, south FROM stock_list
             WHERE spare_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [itemCode]
          );

          let totalDB = 0, delhiDB = 0, southDB = 0;
          if (rows.length > 0) {
            totalDB = rows[0].total || 0;
            delhiDB = rows[0].delhi || 0;
            southDB = rows[0].south || 0;
          }

          let delhiD = delhiDB, southD = southDB;
          if (godown === "Delhi - Mundka") {
            delhiD = delhiDB + quantity;
          } else {
            southD = southDB + quantity;
          }
          const totalD = totalDB + quantity;

          await conn.execute(
            `INSERT INTO stock_list
              (spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
              VALUES (?, ?, NULL, NULL, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [itemCode, quantity, "Partial Return", "Partial Return", companyName, companyAddress, quoteNumber, order_id, username, godown, totalD, delhiD, southD]
          );

          const [summary] = await conn.execute(
            `SELECT total_quantity, ${locationColumn} FROM stock_summary WHERE spare_id = ?`,
            [itemCode]
          );
          if (summary.length > 0) {
            const prevTotal = summary[0].total_quantity || 0;
            const prev = summary[0][locationColumn] || 0;
            const newTotal = prevTotal + quantity;
            const newv = prev + quantity;
            await conn.execute(
              `UPDATE stock_summary
                SET last_updated_quantity = ?, total_quantity = ?, last_status = 'IN', updated_at = NOW(), ${locationColumn} = ?
                WHERE spare_id = ?`,
              [quantity, newTotal, newv, itemCode]
            );
          }
        }

        // Mark dispatch item as stock_deducted = 0
        await conn.execute(
          `UPDATE dispatch SET stock_deducted = 0, updated_at = NOW() WHERE id = ?`,
          [dispatch_id]
        );

        returnedCount++;
      }

      // Check if all items are now returned
      const [allDispatch] = await conn.execute(
        `SELECT COUNT(*) as total, SUM(CASE WHEN stock_deducted = 1 THEN 1 ELSE 0 END) as remaining
         FROM dispatch WHERE quote_number = ?`,
        [quoteNumber]
      );

      const isFullyReturned = allDispatch[0].remaining === 0;

      // Update order status: 2 = partially returned, 1 = fully returned
      await conn.execute(
        `UPDATE neworder SET installation_status = 0, is_returned = ? WHERE order_id = ?`,
        [isFullyReturned ? 1 : 2, order_id]
      );

      return NextResponse.json({
        success: true,
        message: `${returnedCount} item(s) returned successfully`,
        is_fully_returned: isFullyReturned
      });
    }

    // RETURNED logic below
    const quoteNumber = orderRow.quote_number;

    if (!quoteNumber) {
      return NextResponse.json({ error: "Quote number not found for this order" }, { status: 400 });
    }

    // Get dispatch rows for this quote
    const [dispatchRows] = await conn.execute(
      `SELECT id, quote_number, item_code, item_name, stock_deducted, godown
       FROM dispatch WHERE quote_number = ?`,
      [quoteNumber]
    );

    if (!dispatchRows || dispatchRows.length === 0) {
      // No dispatch rows – still mark as returned, no stock adjustment
      await conn.execute(
        `UPDATE neworder SET installation_status = 0, is_returned = 1 WHERE order_id = ?`,
        [order_id]
      );
      return NextResponse.json({
        success: true,
        message: "Order marked as returned (no dispatch rows found)",
      });
    }

    const username = tokenPayload.username || null;
    const companyName = orderRow.company_name || null;
    const companyAddress = orderRow.company_address || null;

    for (const row of dispatchRows) {
      if (row.stock_deducted !== 1) continue;

      const itemCode = row.item_code;
      const godown = row.godown;
      if (!itemCode || !godown) continue;

      const quantity = 1; // each dispatch row is quantity 1
      const locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";

      // Determine if product or spare (same rule as dispatch/update)
      const isProduct = /[a-zA-Z]/.test(itemCode);

      if (isProduct) {
        // Fetch last product stock row to know current totals
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
          totalDB = rows[0].total || 0;
          delhiDB = rows[0].delhi || 0;
          southDB = rows[0].south || 0;
        }

        let delhiD = delhiDB;
        let southD = southDB;
        if (godown === "Delhi - Mundka") {
          delhiD = delhiDB + quantity;
          southD = southDB;
        } else {
          southD = southDB + quantity;
          delhiD = delhiDB;
        }
        const totalD = totalDB + quantity;

        // We do not know amount_per_unit / gst / hsn here reliably, so keep them null
        await conn.execute(
          `INSERT INTO product_stock
            (product_code, quantity, amount_per_unit, net_amount, note, location, stock_status, gst, hs_code, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
            VALUES (?, ?, NULL, NULL, ?, ?, 'IN', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemCode,
            quantity,
            "Installation Return",
            "Installation Return",
            companyName,
            companyAddress,
            quoteNumber,
            order_id,
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
          const prevTotal = summary[0].total_quantity || 0;
          const prev = summary[0][locationColumn] || 0;
          const newTotal = prevTotal + quantity;
          const newv = prev + quantity;
          await conn.execute(
            `UPDATE product_stock_summary
              SET last_updated_quantity = ?, total_quantity = ?, last_status = 'IN', updated_at = NOW(), ${locationColumn} = ?
              WHERE product_code = ?`,
            [quantity, newTotal, newv, itemCode]
          );
        }
      } else {
        // Spare stock reversal
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
          totalDB = rows[0].total || 0;
          delhiDB = rows[0].delhi || 0;
          southDB = rows[0].south || 0;
        }

        let delhiD = delhiDB;
        let southD = southDB;
        if (godown === "Delhi - Mundka") {
          delhiD = delhiDB + quantity;
          southD = southDB;
        } else {
          southD = southDB + quantity;
          delhiD = delhiDB;
        }
        const totalD = totalDB + quantity;

        await conn.execute(
          `INSERT INTO stock_list
            (spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
            VALUES (?, ?, NULL, NULL, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemCode,
            quantity,
            "Installation Return",
            "Installation Return",
            companyName,
            companyAddress,
            quoteNumber,
            order_id,
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
          const prevTotal = summary[0].total_quantity || 0;
          const prev = summary[0][locationColumn] || 0;
          const newTotal = prevTotal + quantity;
          const newv = prev + quantity;
          await conn.execute(
            `UPDATE stock_summary
              SET last_updated_quantity = ?, total_quantity = ?, last_status = 'IN', updated_at = NOW(), ${locationColumn} = ?
              WHERE spare_id = ?`,
            [quantity, newTotal, newv, itemCode]
          );
        }
      }

      // Mark this dispatch row as stock_deducted = 0 so it won't be reversed again
      await conn.execute(
        `UPDATE dispatch SET stock_deducted = 0, updated_at = NOW() WHERE id = ?`,
        [row.id]
      );
    }

    // Finally, mark order as returned
    await conn.execute(
      `UPDATE neworder SET installation_status = 0, is_returned = 1 WHERE order_id = ?`,
      [order_id]
    );

    return NextResponse.json({ success: true, message: "Order marked as returned and stock reversed" });
  } catch (e) {
    console.error("Installation action error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
