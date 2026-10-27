import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  let dbConnection;
  try {
    const { orderId } = await req.json();
    // Get a connection from the pool
    dbConnection = await getDbConnection(); 


    await dbConnection.execute("UPDATE neworder SET is_cancelled = ? WHERE order_id = ?", [1, orderId]);

    // Return a success response
    return NextResponse.json({ message: "Order cancelled successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error in cancel-order API:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  } finally {
    // Crucially, release the connection back to the pool
    if (dbConnection) {
console.log("worked done for the cancel order");

    }
  }
}