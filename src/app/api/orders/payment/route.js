import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import {
  normalizeStoredPaymentFields,
  resolveNextPaymentCsv,
  sumOrderPaymentAmounts,
} from "@/lib/orderPaymentHistory";
import {
  derivePaymentStatus,
  getOrderTotalForPayment,
} from "@/lib/paymentOrderStatus";

export async function POST(req) {
  let conn;
  try {
    const body = await req.json();
    const orderId = Number(body.order_id);
    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing order_id" }, { status: 400 });
    }

    const newPaymentId = body.payment_id ?? null;
    const newPaymentDate = body.payment_date ?? null;
    const newPaymentAmount = body.payment_amount !== undefined && body.payment_amount !== null
      ? Number(body.payment_amount)
      : null;

    conn = await getDbConnection();

    // Fetch order info (including previous payment fields)
    const [orderRows] = await conn.execute(
      `SELECT o.quote_number, o.duedate, o.totalamt, o.baseAmount, o.taxamt,
              o.payment_id, o.payment_date, o.payment_amount, o.transaction_id,
              qr.grand_total AS quotation_grand_total
       FROM neworder o
       LEFT JOIN quotations_records qr ON qr.quote_number = o.quote_number
       WHERE o.order_id = ?`,
      [orderId]
    );
    if (!Array.isArray(orderRows) || orderRows.length === 0) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }
    const order = orderRows[0];
    const repaired = normalizeStoredPaymentFields(order);
    if (repaired) {
      Object.assign(order, repaired);
    }

    // Fetch term days
    let paymentTermDays = 0;
    if (order.quote_number) {
      const [qRows] = await conn.execute(
        `SELECT payment_term_days FROM quotations_records WHERE quote_number = ?`,
        [order.quote_number]
      );
      if (Array.isArray(qRows) && qRows.length) {
        paymentTermDays = Number(qRows[0]?.payment_term_days) || 0;
      }
    }

    const { nextIds, nextDates, nextAmounts } = resolveNextPaymentCsv(order, {
      paymentId: newPaymentId,
      paymentDate: newPaymentDate,
      paymentAmount: newPaymentAmount,
    });

    const orderAfterPayment = {
      ...order,
      payment_id: nextIds,
      payment_amount: nextAmounts,
    };
    const totalPaid = sumOrderPaymentAmounts(orderAfterPayment);
    const total = getOrderTotalForPayment(order);

    let isOverdue = false;
    const invoiceDateIso = order.duedate;
    if (invoiceDateIso && paymentTermDays > 0) {
      const inv = new Date(invoiceDateIso);
      const due = new Date(inv);
      due.setDate(due.getDate() + paymentTermDays);
      const today = new Date();
      isOverdue = today.setHours(0, 0, 0, 0) > due.setHours(0, 0, 0, 0);
    }

    const paymentStatus = derivePaymentStatus({
      total,
      paidAmount: totalPaid,
      deductionAmount: 0,
      isOverdue,
    });

    await conn.execute(
      `UPDATE neworder SET payment_id = ?, payment_date = ?, payment_amount = ?, payment_status = ? WHERE order_id = ?`,
      [nextIds, nextDates, nextAmounts, paymentStatus, orderId]
    );

    return NextResponse.json({ success: true, payment_status: paymentStatus, total_paid: totalPaid });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || "Server error" }, { status: 500 });
  } finally {
    // await conn?.end();
  }
}


