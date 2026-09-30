import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch suggestions for customer ID, product name, and item code
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // customer, product, itemcode
    const search = searchParams.get("search") || "";
    const limit = 10;

    const connection = await getDbConnection();
    let results = [];

    if (type === "customer") {
      try {
        // Search for customers - using correct column names
        const [rows] = await connection.execute(
          `SELECT DISTINCT customer_id, company, first_name, phone 
           FROM customers 
           WHERE customer_id LIKE ? OR company LIKE ? OR first_name LIKE ? OR phone LIKE ?
           LIMIT ?`,
          [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, limit]
        );
        results = (rows || []).map((row) => ({
          id: row.customer_id,
          label: `${row.customer_id} - ${row.company || row.first_name || ""}`,
          company: row.company,
          first_name: row.first_name,
          phone: row.phone,
        }));
      } catch (err) {
        console.error("Customer search error:", err);
        results = [];
      }
    } else if (type === "product") {
      try {
        // Search for products - using products_list table
        const [rows] = await connection.execute(
          `SELECT DISTINCT item_name, item_code, product_number
           FROM products_list 
           WHERE item_name LIKE ? OR item_code LIKE ? OR product_number LIKE ?
           LIMIT ?`,
          [`%${search}%`, `%${search}%`, `%${search}%`, limit]
        );
        results = (rows || []).map((row) => ({
          id: row.item_name,
          label: `${row.item_name}${row.product_number ? ` (${row.product_number})` : ""}${row.item_code ? ` [${row.item_code}]` : ""}`,
          item_code: row.item_code,
          product_number: row.product_number,
        }));
      } catch (err) {
        console.error("Product search error:", err);
        results = [];
      }
    } else if (type === "itemcode") {
      try {
        // Search for item codes using products_list table
        const [rows] = await connection.execute(
          `SELECT DISTINCT item_code, item_name 
           FROM products_list 
           WHERE item_code LIKE ? OR item_name LIKE ?
           LIMIT ?`,
          [`%${search}%`, `%${search}%`, limit]
        );
        results = (rows || []).map((row) => ({
          id: row.item_code || "N/A",
          label: `${row.item_code || "N/A"} - ${row.item_name || ""}`,
          item_name: row.item_name,
        }));
      } catch (err) {
        console.error("Item code search error:", err);
        results = [];
      }
    }

    return NextResponse.json({
      success: true,
      suggestions: results,
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions", details: error.message },
      { status: 500 }
    );
  }
}
