import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET - Check if bid number already exists
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bidNumber = searchParams.get("bid_number");

    if (!bidNumber || bidNumber.trim() === "") {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Check if bid number exists in the database (table: bids)
    // Just count rows instead of selecting id
    const [result] = await conn.execute(
      "SELECT COUNT(*) as count FROM bids WHERE bid_number = ?",
      [bidNumber.trim()]
    );

    const exists = result && result.length > 0 && result[0].count > 0;

    console.log(`[Bid Duplicate Check] bid_number: "${bidNumber}", exists: ${exists}, count: ${result?.[0]?.count || 0}`);

    return NextResponse.json({
      exists,
      message: exists 
        ? `Bid number "${bidNumber}" already exists in the system` 
        : `Bid number "${bidNumber}" is available`,
    });
  } catch (error) {
    console.error("Error checking bid number:", error);
    return NextResponse.json(
      { error: "Failed to check bid number", detail: error.message },
      { status: 500 }
    );
  }
}
