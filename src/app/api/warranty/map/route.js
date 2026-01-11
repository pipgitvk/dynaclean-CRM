import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const conn = await getDbConnection();
    
    // Fetch all warranty products with their coordinates
    const [rows] = await conn.execute(
      `SELECT 
        id,
        product_name,
        specification,
        model,
        serial_number,
        quantity,
        warranty_period,
        customer_name,
        email,
        contact,
        contact_person,
        customer_address,
        installed_address,
        installation_date,
        lat,
        longt,
        site_person,
        site_contact,
        site_email,
        invoice_number,
        invoice_date
      FROM warranty_products 
      WHERE lat IS NOT NULL 
        AND longt IS NOT NULL 
        AND lat != '' 
        AND longt != ''
      ORDER BY id DESC`
    );
    
    return NextResponse.json({ 
      success: true,
      products: rows,
      count: rows.length
    });
  } catch (error) {
    console.error("Error fetching warranty products for map:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch warranty products",
        products: [],
        count: 0
      },
      { status: 500 }
    );
  }
}
