import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePaymentPendingFollowupsTable } from "@/lib/ensurePaymentPendingFollowupsTable";
import { ensurePaymentDeductionsTable } from "@/lib/ensurePaymentDeductionsTable";
import { PAYMENT_PENDING_ORDER_SQL_WHERE } from "@/lib/paymentPendingFilters";
import {
  calculateAdjustedOrderTotal,
  computeOrderPaymentRemaining,
  roundInr,
} from "@/lib/paymentOrderStatus";
import {
    buildPaymentLinesForDisplay,
    sumOrderPaymentAmounts,
} from "@/lib/orderPaymentHistory";
import { ensureOrderDeliveryBatchesTable } from "@/lib/orderDeliveryBatches";
import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";
import {
  collectOrderDeliveryDateStrings,
  computeDueDateFromDeliveryAndTerms,
  pickDeliveryAnchorForDueDate,
  uniqueSortedDateStrings,
} from "@/lib/paymentPendingOrderDates";

export async function GET(request) {
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { role, username } = payload;

        // Check if user has access to this report
        const allowedRoles = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "HR HEAD", "SALES", "SALES CUM BACKOFFICE", "TEAM LEADER", "DIRECTOR", "GEM PORTAL", "GEM"];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const completionFilter = (searchParams.get("completion") || "pending").toLowerCase();

        const pool = await getDbConnection();
        await ensurePaymentPendingFollowupsTable();
        await ensurePaymentDeductionsTable();

        // Build SQL query based on role
        let sql = `
      SELECT 
        o.order_id,
        o.quote_number,
        o.client_name,
        o.contact,
        o.created_by,
        o.totalamt,
        o.baseAmount,
        o.taxamt,
        o.payment_amount,
        o.payment_id,
        o.payment_date,
        o.amount_received,
        o.payment_received_date,
        o.linked_payments_json,
        o.transaction_id,
        qr.grand_total AS quotation_grand_total,
        o.payment_status,
        o.duedate,
        o.delivery_date,
        o.delivered_on,
        o.created_at,
        o.company_name,
        o.is_returned,
        qr.payment_term_days,
        c.customer_id,
        ppf_latest.next_followup_date AS next_followup_date,
        ppf_latest.notes AS latest_remark
      FROM neworder AS o
      LEFT JOIN quotations_records AS qr
        ON qr.quote_number = o.quote_number
      LEFT JOIN customers AS c 
        ON o.contact COLLATE utf8mb4_unicode_ci = c.phone COLLATE utf8mb4_unicode_ci
      LEFT JOIN (
        SELECT ppf.order_id, ppf.next_followup_date, ppf.notes
        FROM payment_pending_followups ppf
        INNER JOIN (
          SELECT order_id, MAX(id) AS max_id
          FROM payment_pending_followups
          GROUP BY order_id
        ) t ON t.order_id = ppf.order_id AND t.max_id = ppf.id
      ) ppf_latest ON ppf_latest.order_id COLLATE utf8mb4_unicode_ci = o.order_id COLLATE utf8mb4_unicode_ci
      WHERE ${PAYMENT_PENDING_ORDER_SQL_WHERE}
    `;

        // Filter for SALES and GEM roles - only their own orders
        // SALES CUM BACKOFFICE sees ALL orders (no filter)
        if (role === "SALES" || role === "GEM PORTAL" || role === "GEM") {
            sql += ` AND o.created_by COLLATE utf8mb4_unicode_ci = ?`;
        }

        const [rows] = (role === "SALES" || role === "GEM PORTAL" || role === "GEM")
            ? await pool.query(sql, [username])
            : await pool.query(sql);

        const orderIds = rows.map((order) => order.order_id).filter(Boolean);
        const deliveryBatchDatesByOrder = new Map();
        const installationDatesByOrder = new Map();
        const serviceIdsByOrder = new Map();

        if (orderIds.length > 0) {
            const conn = await pool.getConnection();
            try {
                await ensureOrderDeliveryBatchesTable(conn);
                const placeholders = orderIds.map(() => "?").join(",");

                const [deliveryBatchRows] = await conn.execute(
                    `SELECT order_id, delivered_on
                     FROM order_delivery_batches
                     WHERE order_id IN (${placeholders})
                       AND delivered_on IS NOT NULL`,
                    orderIds,
                );
                for (const row of deliveryBatchRows || []) {
                    if (!deliveryBatchDatesByOrder.has(row.order_id)) {
                        deliveryBatchDatesByOrder.set(row.order_id, []);
                    }
                    deliveryBatchDatesByOrder.get(row.order_id).push(row.delivered_on);
                }

                const serialJoin = sqlTrimUtf8EqColumns(
                    "sr.serial_number",
                    "d.serial_no",
                );
                const quoteJoin = sqlTrimUtf8EqColumns(
                    "no.quote_number",
                    "d.quote_number",
                );
                try {
                    const [installationRows] = await conn.execute(
                        `SELECT no.order_id,
                                GROUP_CONCAT(
                                  DISTINCT DATE_FORMAT(sr.completed_date, '%Y-%m-%d')
                                  ORDER BY sr.completed_date
                                  SEPARATOR ','
                                ) AS installation_dates,
                                GROUP_CONCAT(
                                  DISTINCT sr.service_id
                                  ORDER BY sr.service_id
                                  SEPARATOR ','
                                ) AS service_ids
                         FROM neworder no
                         INNER JOIN dispatch d ON ${quoteJoin}
                         INNER JOIN service_records sr
                           ON ${serialJoin}
                          AND UPPER(TRIM(sr.service_type)) = 'INSTALLATION'
                          AND UPPER(TRIM(sr.status)) = 'COMPLETED'
                          AND sr.completed_date IS NOT NULL
                         WHERE no.order_id IN (${placeholders})
                           AND d.serial_no IS NOT NULL
                           AND TRIM(d.serial_no) <> ''
                         GROUP BY no.order_id`,
                        orderIds,
                    );
                    for (const row of installationRows || []) {
                        const dateParts = String(row.installation_dates || "")
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean);
                        installationDatesByOrder.set(row.order_id, dateParts);

                        const idParts = String(row.service_ids || "")
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean);
                        serviceIdsByOrder.set(row.order_id, idParts);
                    }
                } catch (instErr) {
                    console.error("Error fetching installation dates:", instErr);
                }
            } finally {
                conn.release();
            }
        }

        const deductionByOrder = new Map();
        if (rows.length > 0) {
            try {
                const orderIds = rows.map((order) => order.order_id);
                const placeholders = orderIds.map(() => "?").join(",");
                const [deductionRows] = await pool.query(
                    `SELECT order_id, deduction_type, amount, recorded_date
                     FROM payment_deductions
                     WHERE order_id IN (${placeholders})
                     ORDER BY recorded_date DESC`,
                    orderIds
                );
                for (const deduction of deductionRows) {
                    if (!deductionByOrder.has(deduction.order_id)) {
                        deductionByOrder.set(deduction.order_id, {
                            latest: deduction.deduction_type,
                            total: 0
                        });
                    }
                    const existing = deductionByOrder.get(deduction.order_id);
                    existing.total += parseFloat(deduction.amount || 0);
                }
            } catch (err) {
                console.error("Error fetching payment deductions:", err);
            }
        }

        // Calculate remaining amount for each order
        const orders = await Promise.all(rows.map(async (order) => {
            const totalAmt = await calculateAdjustedOrderTotal(pool, order);
            const paidAmount = sumOrderPaymentAmounts(order);
            const deductionInfo = deductionByOrder.get(order.order_id);
            const deductionAmount = deductionInfo?.total || 0;
            const { remaining, displayPaid } = computeOrderPaymentRemaining(
              totalAmt,
              paidAmount,
              deductionAmount,
            );

            const deliveryDates = collectOrderDeliveryDateStrings({
                deliveredOn: order.delivered_on,
                deliveryBatchDates:
                    deliveryBatchDatesByOrder.get(order.order_id) || [],
            });
            const deliveryAnchor = pickDeliveryAnchorForDueDate(deliveryDates);
            const paymentTermDays = Number(order.payment_term_days) || 0;
            const computedDue =
                computeDueDateFromDeliveryAndTerms(
                    deliveryAnchor,
                    paymentTermDays,
                ) || order.duedate;
            const installationDates =
                installationDatesByOrder.get(order.order_id) ||
                uniqueSortedDateStrings([]);
            const paymentLines = buildPaymentLinesForDisplay(order);

            return {
                order_id: order.order_id,
                quote_number: order.quote_number,
                client_name: order.client_name,
                company_name: order.company_name,
                contact: order.contact,
                created_by: order.created_by,
                total_amount: roundInr(totalAmt),
                paid_amount: displayPaid,
                payment_lines: paymentLines,
                deduction_amount: roundInr(deductionAmount),
                remaining_amount: remaining,
                due_date: computedDue,
                delivery_dates: deliveryDates,
                installation_dates: installationDates,
                service_ids: serviceIdsByOrder.get(order.order_id) || [],
                payment_term_days: paymentTermDays,
                next_followup_date: order.next_followup_date || null,
                latest_remark: order.latest_remark || null,
                payment_status: order.payment_status || 'pending',
                created_at: order.created_at,
                is_partially_returned: order.is_returned === 2,
                customer_id: order.customer_id,
                latest_deduction: deductionInfo?.latest || null,
                is_completed: remaining <= 0
            };
        }));

        let filteredOrders = orders;
        if (completionFilter === "pending") {
            filteredOrders = orders.filter((order) => order.remaining_amount > 0);
        } else if (completionFilter === "completed") {
            filteredOrders = orders.filter((order) => order.remaining_amount <= 0);
        }

        filteredOrders.sort((a, b) => {
            const aDue = a.due_date ? new Date(a.due_date).getTime() : 0;
            const bDue = b.due_date ? new Date(b.due_date).getTime() : 0;
            return aDue - bDue;
        });

        return NextResponse.json({
            success: true,
            orders: filteredOrders,
            userRole: role
        });

    } catch (error) {
        console.error("Error fetching payment pending report:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
