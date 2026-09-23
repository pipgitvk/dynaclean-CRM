import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch suggestions for customer ID, product name, item code, and order ID
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // customer, product, itemcode, orderid
    const search = searchParams.get("search") || "";
    const customerId = searchParams.get("customer_id") || "";
    const limit = 10;

    const connection = await getDbConnection();
    let results = [];

    if (type === "customer") {
      try {
        const [rows] = await connection.execute(
          `SELECT DISTINCT customer_id, company, first_name, phone 
           FROM customers 
           WHERE customer_id LIKE ? OR company LIKE ? OR first_name LIKE ? OR phone LIKE ?
           LIMIT ?`,
          [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, limit],
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
        const [rows] = await connection.execute(
          `SELECT DISTINCT item_name, item_code, product_number
           FROM products_list 
           WHERE item_name LIKE ? OR item_code LIKE ? OR product_number LIKE ?
           LIMIT ?`,
          [`%${search}%`, `%${search}%`, `%${search}%`, limit],
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
        const [rows] = await connection.execute(
          `SELECT DISTINCT item_code, item_name 
           FROM products_list 
           WHERE item_code LIKE ? OR item_name LIKE ?
           LIMIT ?`,
          [`%${search}%`, `%${search}%`, limit],
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
    } else if (type === "orderid") {
      try {
        let query = `
          SELECT order_id, customer_id, client_name, quote_number, invoice_date, approval_status
          FROM neworder
          WHERE 1=1
        `;
        const params = [];

        if (search.trim()) {
          query += ` AND (
            CAST(order_id AS CHAR) LIKE ? OR
            client_name LIKE ? OR
            quote_number LIKE ? OR
            CAST(customer_id AS CHAR) LIKE ?
          )`;
          params.push(
            `%${search}%`,
            `%${search}%`,
            `%${search}%`,
            `%${search}%`,
          );
        } else if (customerId.trim()) {
          query += ` AND customer_id = ?`;
          params.push(customerId.trim());
        }

        query += ` ORDER BY invoice_date DESC, order_id DESC LIMIT ?`;
        params.push(limit);

        const [rows] = await connection.execute(query, params);
        results = (rows || []).map((row) => ({
          id: row.order_id,
          label: `${row.order_id} - ${row.client_name || "Unnamed"}`,
          customer_id: row.customer_id,
          client_name: row.client_name,
          quote_number: row.quote_number,
          invoice_date: row.invoice_date,
          approval_status: row.approval_status,
        }));
      } catch (err) {
        console.error("Order ID search error:", err);
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
      { status: 500 },
    );
  }
}
