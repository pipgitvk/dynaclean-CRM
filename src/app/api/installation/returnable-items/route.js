import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

/**
 * GET /api/installation/returnable-items?order_id=XXX
 * Fetches all dispatch items for an order that can be returned
 */
export async function GET(req) {
    try {
        const tokenPayload = await getSessionPayload();
        if (!tokenPayload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const orderId = searchParams.get("order_id");

        if (!orderId) {
            return NextResponse.json({ error: "order_id is required" }, { status: 400 });
        }

        const conn = await getDbConnection();

        // Get order details
        const [orderRows] = await conn.execute(
            `SELECT id, order_id, quote_number, company_name, is_returned
       FROM neworder WHERE order_id = ? LIMIT 1`,
            [orderId]
        );

        if (!orderRows || !orderRows[0]) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        const order = orderRows[0];
        const quoteNumber = order.quote_number;

        if (!quoteNumber) {
            return NextResponse.json({ error: "Quote number not found for this order" }, { status: 400 });
        }

        // Get all dispatch items for this quote
        const [dispatchRows] = await conn.execute(
            `SELECT id, quote_number, item_code, item_name, serial_no, godown, stock_deducted
       FROM dispatch WHERE quote_number = ?`,
            [quoteNumber]
        );

        if (!dispatchRows || dispatchRows.length === 0) {
            return NextResponse.json({
                success: true,
                order_id: orderId,
                items: [],
                message: "No dispatch items found for this order"
            });
        }

        // Get already returned items
        const [returnedRows] = await conn.execute(
            `SELECT dispatch_id, quantity_returned
       FROM order_return_items WHERE order_id = ?`,
            [orderId]
        );

        // Create a map of returned quantities by dispatch_id
        const returnedMap = {};
        returnedRows.forEach(row => {
            returnedMap[row.dispatch_id] = (returnedMap[row.dispatch_id] || 0) + row.quantity_returned;
        });

        // Build the returnable items list
        const items = dispatchRows.map(row => {
            const quantityReturned = returnedMap[row.id] || 0;
            const canReturn = row.stock_deducted === 1 && quantityReturned === 0;

            return {
                dispatch_id: row.id,
                item_code: row.item_code,
                item_name: row.item_name,
                serial_no: row.serial_no,
                godown: row.godown,
                quantity_dispatched: 1, // Each dispatch row is 1 item
                quantity_returned: quantityReturned,
                can_return: canReturn,
                stock_deducted: row.stock_deducted
            };
        });

        return NextResponse.json({
            success: true,
            order_id: orderId,
            quote_number: quoteNumber,
            company_name: order.company_name,
            is_returned: order.is_returned,
            items: items,
            total_items: items.length,
            returnable_items: items.filter(i => i.can_return).length
        });

    } catch (e) {
        console.error("Error fetching returnable items:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
