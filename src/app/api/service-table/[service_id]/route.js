import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(req, { params }) {
  const { service_id } = params;

  if (!service_id) {
    return NextResponse.json({ error: "Service ID is required" }, { status: 400 });
  }

  try {
    const connection = await getDbConnection();

    // 1. First query: Get the core service record data and serial number.
    const [serviceRows] = await connection.execute(
      `SELECT * FROM service_records WHERE service_id = ?`,
      [service_id]
    );

    if (serviceRows.length === 0) {
          // await connection.end();
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const serviceData = serviceRows[0];
    const serialNumber = serviceData.serial_number;

    // 2. Second query: Use the serial number to get data from warranty_products.
    let warrantyData = {};
    if (serialNumber) {
      const [warrantyRows] = await connection.execute(
        `SELECT
          product_name,
          specification,
          warranty_period,
          customer_address,
          installed_address,
          installation_date,
          invoice_number,
          invoice_date,
          customer_name,
          email,
          contact,
          model
        FROM warranty_products WHERE serial_number = ?`,
        [serialNumber]
      );
      if (warrantyRows.length > 0) {
        warrantyData = warrantyRows[0];
      }
    }

        // await connection.end();

    // Handle the `attachments` field.
    const attachmentsArray = serviceData.attachments 
      ? serviceData.attachments.split(',').map(item => item.trim()) 
      : [];

      const complaintDate = serviceData.complaint_date
      console.log("Complaint Date:", complaintDate);
      
    
    // Combine all the data into a single object.
    const combinedData = {
      ...serviceData,
      ...warrantyData,
      attachments: attachmentsArray,
      // You also have a "Warranty Expiry" field in PHP which is calculated.
      // Let's add that here for completeness.
      // Make sure `installationDate` and `warrantyPeriod` are valid.
      warranty_expiry: (warrantyData.installation_date && warrantyData.warranty_period)
        ? new Date(new Date(warrantyData.installation_date).setMonth(new Date(warrantyData.installation_date).getMonth() + warrantyData.warranty_period)).toISOString().split('T')[0]
        : null,
    };

    return NextResponse.json(combinedData);
  } catch (error) {
    console.error("GET service error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}