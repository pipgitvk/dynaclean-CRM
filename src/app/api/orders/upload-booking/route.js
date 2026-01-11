// // app/api/orders/upload-booking/route.js
// import { NextResponse } from "next/server";
// import { getDbConnection } from "@/lib/db";

// export async function POST(req) {
//   try {
//     const body = await req.json();
//     const {
//       orderId,
//       quote,
//       booking_id,
//       booking_date,
//       taskassignto,
//       booking_url,
//       adminremark,
//     } = body;

//     if (!orderId || !booking_id || !booking_date || !taskassignto || !booking_url) {
//       return NextResponse.json({ error: "Missing fields" }, { status: 400 });
//     }

//     const conn = await mysql.createConnection({
//       host: process.env.DB_HOST,
//       user: process.env.DB_USER,
//       password: process.env.DB_PASS,
//       database: process.env.DB_NAME,
//     });

//     const [result] = await conn.execute(
//       `UPDATE neworder SET 
//         booking_url = ?, 
//         booking_id = ?, 
//         booking_date = ?, 
//         admin_status = ?, 
//         dispatch_person = ?, 
//         admin_remark = ?
//        WHERE order_id = ?`,
//       [booking_url, booking_id, booking_date, 1, taskassignto, adminremark, orderId]
//     );

//         // await conn.end();
//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error("❌ Booking Upload Error:", error);
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }





import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      orderId,
      quote,
      booking_id,
      booking_date,
      booking_url,
      adminremark,
      expected_delivery_date
    } = body;

    if (!orderId || !booking_id || !booking_date || !booking_url) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate mandatory adminremark field
    if (!adminremark || adminremark.trim() === '') {
      return NextResponse.json({ error: "Admin Remark is required" }, { status: 400 });
    }

    console.log('This is the correct we should get orderId:', orderId);

    const conn = await getDbConnection();
    const payload = await getSessionPayload();
    const bookingBy = payload?.username || payload?.name || null;

    // ✅ Step 1: Update neworder table with booking info (without godown)
    await conn.execute(
      `UPDATE neworder SET 
        booking_url = ?, 
        booking_id = ?, 
        booking_date = ?, 
        admin_status = ?, 
        booking_by = ?, 
        admin_remark = ?,
        delivery_date = ?
    WHERE order_id = ?`,
      [booking_url, booking_id, booking_date, 1, bookingBy, adminremark, expected_delivery_date, orderId]
    );

    // Do not reduce stock on booking upload; stock will be reduced on dispatch update.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Booking Upload Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
