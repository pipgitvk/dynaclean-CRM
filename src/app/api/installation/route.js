import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/template-utils";


export async function POST(req) {
  try {
    const {
      serial_number,
      service_type,
      installation_address,
      site_person,
      site_email,
      site_contact,
      status,
      username,
    } = await req.json();

    // Basic validation
    if (
      !serial_number ||
      !service_type ||
      !installation_address ||
      !site_person ||
      !site_email ||
      !site_contact ||
      !status ||
      !username
    ) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Connect DB
    const conn = await getDbConnection();

    // Insert into service_records
    const [result] = await conn.execute(
      `INSERT INTO service_records 
       (serial_number, service_type, complaint_date, complaint_summary, status, assigned_to)
       VALUES (?, ?, CURDATE(), ?, ?, ?)`,
      [serial_number, service_type, "Scheduled for Installation", status, username]
    );

    // Update warranty_products
    await conn.execute(
      `UPDATE warranty_products 
       SET installed_address = ?, site_person = ?, site_contact = ?, site_email = ? 
       WHERE serial_number = ?`,
      [installation_address, site_person, site_contact, site_email, serial_number]
    );

    // Fetch email info for sending
    const [rows] = await conn.execute(
      `SELECT email, customer_name, product_name, model FROM warranty_products WHERE serial_number = ?`,
      [serial_number]
    );

    // If product exists, try to send an email, but don't fail the whole request if email fails.
    if (rows.length > 0) {
      const { email: recipientEmail, customer_name, product_name, model } = rows[0];

      if (recipientEmail) {
        // Prepare template data
        const templateData = {
          service_id: result.insertId,
          customer_name,
          product_name,
          model,
          serial_number,
          site_person,
          site_email,
          site_contact,
          installation_address,
          service_type,
          current_year: new Date().getFullYear(),
        };

        try {
          // Send email using template system
          await sendTemplatedEmail(
            'INSTALLATION',
            templateData,
            {
              to: recipientEmail,
              cc: "service@dynacleanindustries.com, dynacleanindustries@gmail.com",
              bcc: "piptrade3@gmail.com",
            }
          );
        } catch (emailError) {
          console.error("Email sending failed (but installation request saved):", emailError);
        }
      }
    }

    return NextResponse.json({ message: "Installation request submitted successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
