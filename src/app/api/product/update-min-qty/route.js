import { getDbConnection } from "@/lib/db";
import { NextResponse } from 'next/server';

export async function POST(req) {
  let connection;
  try {
    const { productCode, minQty } = await req.json();

    if (!productCode || minQty === undefined) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get a connection from the pool
    connection = await getDbConnection();
    const query = `
      UPDATE products_list
      SET min_qty = ?
      WHERE item_code = ?;
    `;
    
    // Use the connection to execute the query
    const [result] = await connection.execute(query, [minQty, productCode]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Min Qty updated successfully." }, { status: 200 });
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  } finally {
    // Release the connection back to the pool
  console.log("Releasing database connection");
  
  }
}