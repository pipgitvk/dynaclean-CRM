// pages/api/table-data/route.js

import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET(req) {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Authentication token missing." }, { status: 401 });
  }

  let username;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    username = decoded.username;
  } catch (error) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  if (!type) {
    return NextResponse.json({ error: "Table type is required." }, { status: 400 });
  }

  let query;
  let params;
  let tableName;

  switch (type) {
    case 'quotations':
      query = 'SELECT * FROM quotations_records WHERE emp_name = ?';
      params = [username];
      tableName = 'Quotations';
      break;
    case 'customers':
      query = 'SELECT * FROM customers WHERE lead_source = ? AND status = "Very Good"';
      params = [username];
      tableName = 'Customers';
      break;
    case 'orders':
      query = 'SELECT * FROM neworder WHERE invoice_number IS NOT NULL AND invoice_number != "" AND created_by = ?';
      params = [username];
      tableName = 'New Orders';
      break;
    default:
      return NextResponse.json({ error: 'Invalid table type.' }, { status: 400 });
  }

  try {
    const db = await getDbConnection();
    const [rows] = await db.execute(query, params);

    console.log("***********************");
    console.log("this is the table:",rows);
    
    
    
    return NextResponse.json({
      tableName,
      data: rows,
    });
  } catch (error) {
    console.error(`Database query for ${type} failed:`, error);
    return NextResponse.json({ error: "Failed to fetch table data." }, { status: 500 });
  }
}