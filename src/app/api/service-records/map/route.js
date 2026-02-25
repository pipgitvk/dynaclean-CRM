import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const conn = await getDbConnection();
    
    // Fetch all service records with their coordinates from warranty_products
    const [rows] = await conn.execute(
      `SELECT 
        sr.service_id,
        sr.serial_number,
        sr.service_type,
        sr.complaint_date,
        sr.complaint_summary,
        sr.status,
        sr.assigned_to,
        sr.completed_date,
        sr.reg_date,
        wp.product_name,
        wp.model,
        wp.customer_name,
        wp.email,
        wp.contact,
        wp.installed_address,
        wp.customer_address,
        wp.lat,
        wp.longt,
        wp.warranty_period
      FROM service_records sr
      LEFT JOIN warranty_products wp ON sr.serial_number COLLATE utf8mb3_unicode_ci = wp.serial_number
      WHERE wp.lat IS NOT NULL 
        AND wp.longt IS NOT NULL 
        AND wp.lat != '' 
        AND wp.longt != ''
      ORDER BY sr.service_id DESC`
    );
    
    return NextResponse.json({ 
      success: true,
      services: rows,
      count: rows.length
    });
  } catch (error) {
    console.error("Error fetching service records for map:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch service records",
        services: [],
        count: 0
      },
      { status: 500 }
    );
  }
}
