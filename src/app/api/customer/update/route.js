// import { NextResponse } from "next/server";
// import { getDbConnection } from "@/lib/db";

// export async function POST(req) {
//   const { customer_id, first_name, email, tags, status } = await req.json();
//   if (!customer_id) {
//     return NextResponse.json({ error: "Missing customer_id" }, { status: 400 });
//   }

//   try {
//     const conn = await getDbConnection();

//     await conn.execute(
//       `UPDATE customers SET first_name=?, email=?, tags=?, status=? WHERE customer_id=?`,
//       [first_name, email, tags, status, customer_id]
//     );

//         // await conn.end();
//     return NextResponse.json({ success: true });
//   } catch (err) {
//     console.error("Update failed:", err);
//     return NextResponse.json({ error: "Update failed" }, { status: 500 });
//   }
// }



import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  try {
    console.log("👉 [DEBUG] Starting POST request handler.");

    const body = await req.json();
    console.log("👉 [DEBUG] Received request body:", body);
    const { customer_id, first_name, company, email, tags, status, gstin, stage, address } = body;

    if (!customer_id) {
      console.log("👉 [DEBUG] Missing 'customer_id'. Sending 400 response.");
      return NextResponse.json({ error: "Missing customer_id" }, { status: 400 });
    }

    console.log("👉 [DEBUG] Attempting to get database connection.");
    const conn = await getDbConnection();
    console.log("👉 [DEBUG] Database connection successful.");

    const updateQuery = `UPDATE customers SET first_name=?, company=?, email=?, tags=?, status=?, gstin=?, stage=?, address=? WHERE customer_id=?`;
    const queryParams = [first_name, company, email, tags, status, gstin ?? null, stage, address, customer_id];
    console.log("👉 [DEBUG] Executing SQL query:", updateQuery);
    console.log("👉 [DEBUG] With parameters:", queryParams);

    await conn.execute(updateQuery, queryParams);
    console.log("👉 [DEBUG] SQL update executed successfully.");

    // Note: The original code had a commented-out 'await conn.end();'.
    // If you uncomment this, the connection will be closed.
    // Make sure this is the desired behavior for your application's connection pooling strategy.

    console.log("👉 [DEBUG] Sending success response.");
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("❌ [ERROR] Update failed:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}