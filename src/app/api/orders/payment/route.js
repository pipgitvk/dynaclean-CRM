import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

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
      `SELECT quote_number, duedate, totalamt, payment_id, payment_date, payment_amount FROM neworder WHERE order_id = ?`,
      [orderId]
    );
    if (!Array.isArray(orderRows) || orderRows.length === 0) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }
    const order = orderRows[0];

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

    // Compute payment status
    let paymentStatus = "pending";
    // Build comma-separated histories
    const prevIds = (order.payment_id || "").toString().trim();
    const prevDates = (order.payment_date || "").toString().trim();
    const prevAmounts = (order.payment_amount || "").toString().trim();

    const nextIds = newPaymentId
      ? (prevIds ? `${prevIds},${newPaymentId}` : newPaymentId)
      : prevIds || null;
    const nextDates = newPaymentDate
      ? (prevDates ? `${prevDates},${newPaymentDate}` : newPaymentDate)
      : prevDates || null;
    const nextAmounts = (newPaymentAmount !== null && !isNaN(newPaymentAmount))
      ? (prevAmounts ? `${prevAmounts},${newPaymentAmount}` : String(newPaymentAmount))
      : prevAmounts || null;

    // Compute totals from nextAmounts CSV
    const totalPaid = (nextAmounts || "")
      .toString()
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => !isNaN(n))
      .reduce((sum, n) => sum + n, 0);

    const total = Number(order.totalamt) || 0;

    let isOverdue = false;
    const invoiceDateIso = order.duedate; // field used as invoice date
    if (invoiceDateIso && paymentTermDays > 0) {
      const inv = new Date(invoiceDateIso);
      const due = new Date(inv);
      due.setDate(due.getDate() + paymentTermDays);
      const today = new Date();
      isOverdue = today.setHours(0, 0, 0, 0) > due.setHours(0, 0, 0, 0);
    }

    if (totalPaid >= total && total >= 0) paymentStatus = "paid";
    else if (totalPaid > 0 && totalPaid < total) paymentStatus = "partially paid";
    else if (totalPaid === 0 && isOverdue) paymentStatus = "over due";
    else paymentStatus = "pending";

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


