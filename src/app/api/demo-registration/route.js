import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const {
      customerId,
      demo_address,
      demo_date_time,
      machine1,
      model1,
      machine2,
      model2,
      machine3,
      model3,
    } = await req.json();

    // ✅ Extract username from JWT in cookies
   
  let username = "Unknown";
  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }
  username = payload.username;


    // ✅ MySQL connection
    const conn = await getDbConnection();

    // ✅ Execute insert with SELECT subquery
    await conn.execute(
      `INSERT INTO demoregistration 
        (customer_id, customer_name, email, mobile, company,
         demo_address, demo_date_time, machine1, model1,
         machine2, model2, machine3, model3, username)
       SELECT c.customer_id, c.first_name, c.email, c.phone, c.company,
              ?, ?, ?, ?, ?, ?, ?, ?, ? 
       FROM customers c 
       WHERE c.customer_id = ?`,
      [
        demo_address,
        demo_date_time,
        machine1,
        model1,
        machine2,
        model2,
        machine3,
        model3,
        username,
        customerId,
      ]
    );

        // await conn.end();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Demo registration error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
