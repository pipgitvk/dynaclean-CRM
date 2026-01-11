import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET() {
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { role, username } = payload;

        // Check if user has access to this report
        const allowedRoles = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "HR HEAD", "SALES", "SALES HEAD", "TEAM LEADER"];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const pool = await getDbConnection();

        // Build SQL query based on role
        let sql = `
      SELECT 
        order_id,
        quote_number,
        client_name,
        company_name,
        contact,
        created_by,
        totalamt,
        payment_amount,
        payment_date,
        payment_status,
        duedate,
        created_at,
        is_returned,
        invoice_date
      FROM neworder
      WHERE (is_cancelled = 0 OR is_cancelled IS NULL)
    `;

        // Filter for SALES role - only their own orders
        if (role === "SALES") {
            sql += ` AND created_by = ?`;
        }

        sql += ` ORDER BY duedate DESC`;

        const [rows] = role === "SALES"
            ? await pool.query(sql, [username])
            : await pool.query(sql);

        // Analyze payment behavior for each order
        const orders = await Promise.all(rows.map(async (order) => {
            let totalAmt = parseFloat(order.totalamt || 0);

            // If partially returned, calculate adjusted total
            if (order.is_returned === 2 && order.quote_number) {
                try {
                    // Get returned items for this order
                    const [returnedItems] = await pool.query(
                        `SELECT item_code, quantity_returned FROM order_return_items WHERE order_id = ?`,
                        [order.order_id]
                    );

                    if (returnedItems.length > 0) {
                        // Get prices from quotation_items
                        const itemCodes = returnedItems.map(item => item.item_code);
                        const placeholders = itemCodes.map(() => '?').join(',');

                        const [quotationItems] = await pool.query(
                            `SELECT item_code, total_price, quantity FROM quotation_items 
                             WHERE quote_number = ? AND item_code IN (${placeholders})`,
                            [order.quote_number, ...itemCodes]
                        );

                        // Calculate total value of returned items
                        let returnedValue = 0;
                        returnedItems.forEach(returnedItem => {
                            const quotItem = quotationItems.find(q => q.item_code === returnedItem.item_code);
                            if (quotItem) {
                                // Calculate price per unit and multiply by returned quantity
                                const pricePerUnit = parseFloat(quotItem.total_price) / parseInt(quotItem.quantity);
                                returnedValue += pricePerUnit * returnedItem.quantity_returned;
                            }
                        });

                        // Adjust total amount by subtracting returned items value
                        totalAmt = totalAmt - returnedValue;
                    }
                } catch (err) {
                    console.error(`Error calculating returned value for order ${order.order_id}:`, err);
                    // Continue with original total if calculation fails
                }
            }

            // Parse payment_amount which might be comma-separated values
            const paymentAmounts = (order.payment_amount || "")
                .toString()
                .split(",")
                .map(s => parseFloat(s.trim()) || 0);

            const paidAmount = paymentAmounts.reduce((sum, amt) => sum + amt, 0);
            const remaining = Math.max(0, totalAmt - paidAmount); // Never negative

            // Parse payment_date which might be comma-separated values
            const paymentDates = (order.payment_date || "")
                .toString()
                .split(",")
                .map(s => s.trim())
                .filter(s => s && s !== '');

            // Get the latest payment date
            const latestPaymentDate = paymentDates.length > 0
                ? paymentDates[paymentDates.length - 1]
                : null;

            // Determine payment behavior status
            let paymentBehavior = 'unknown';
            let daysOverdue = 0;
            let warningLevel = 'none'; // none, info, warning, danger

            const dueDate = order.duedate ? new Date(order.duedate) : null;
            const lastPaymentDate = latestPaymentDate ? new Date(latestPaymentDate) : null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (dueDate) {
                dueDate.setHours(0, 0, 0, 0);

                // Calculate days overdue
                if (today > dueDate) {
                    daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                }

                if (remaining <= 0) {
                    // Fully paid - check if payment was late
                    if (lastPaymentDate) {
                        lastPaymentDate.setHours(0, 0, 0, 0);
                        if (lastPaymentDate > dueDate) {
                            paymentBehavior = 'late_payment';
                            warningLevel = 'warning';
                            daysOverdue = Math.floor((lastPaymentDate - dueDate) / (1000 * 60 * 60 * 24));
                        } else {
                            paymentBehavior = 'on_time';
                            warningLevel = 'none';
                            daysOverdue = 0; // On time payments show 0 days
                        }
                    } else {
                        // Paid but no payment date recorded
                        paymentBehavior = 'paid_no_date';
                        warningLevel = 'info';
                        daysOverdue = 0; // Paid orders show 0 days
                    }
                } else if (paidAmount > 0) {
                    // Partial payment
                    if (today > dueDate) {
                        paymentBehavior = 'partial_overdue';
                        warningLevel = 'danger';
                    } else {
                        paymentBehavior = 'partial_payment';
                        warningLevel = 'info';
                    }
                } else {
                    // No payment
                    if (today > dueDate) {
                        paymentBehavior = 'missing_payment';
                        warningLevel = 'danger';
                    } else {
                        paymentBehavior = 'pending';
                        warningLevel = 'info';
                    }
                }
            } else {
                // No due date specified
                if (remaining <= 0) {
                    paymentBehavior = 'paid_no_due_date';
                    warningLevel = 'none';
                    daysOverdue = 0; // Paid orders show 0 days
                } else {
                    paymentBehavior = 'no_due_date';
                    warningLevel = 'info';
                }
            }

            return {
                order_id: order.order_id,
                client_name: order.client_name,
                company_name: order.company_name,
                contact: order.contact,
                created_by: order.created_by,
                total_amount: totalAmt,
                paid_amount: paidAmount,
                remaining_amount: remaining,
                due_date: order.duedate,
                payment_date: latestPaymentDate,
                payment_status: order.payment_status || 'pending',
                payment_behavior: paymentBehavior,
                warning_level: warningLevel,
                days_overdue: daysOverdue,
                created_at: order.created_at,
                is_partially_returned: order.is_returned === 2
            };
        }));

        // Calculate summary statistics
        const latePayments = orders.filter(o => o.payment_behavior === 'late_payment');
        const missingPayments = orders.filter(o =>
            o.payment_behavior === 'missing_payment' || o.payment_behavior === 'partial_overdue'
        );
        const totalOverdue = missingPayments.reduce((sum, o) => sum + o.remaining_amount, 0);

        return NextResponse.json({
            success: true,
            orders: orders,
            summary: {
                total_orders: orders.length,
                late_payments_count: latePayments.length,
                missing_payments_count: missingPayments.length,
                total_overdue_amount: totalOverdue,
                avg_days_overdue: missingPayments.length > 0
                    ? missingPayments.reduce((sum, o) => sum + o.days_overdue, 0) / missingPayments.length
                    : 0
            },
            userRole: role
        });

    } catch (error) {
        console.error("Error fetching customer payment behavior report:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
