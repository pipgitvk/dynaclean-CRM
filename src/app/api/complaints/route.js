// app/api/complaints/route.js
import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { sendTemplatedEmail } from '@/lib/template-utils';
import path from 'path';
import fs from 'fs/promises'; // For file system operations

export async function POST(req) {
  try {
    const formData = await req.formData();

    const serial_number = formData.get('serial_number');
    const service_type = formData.get('service_type');
    const complaint_date = formData.get('complaint_date');
    const complaint_summary = formData.get('complaint_summary');
    const status = formData.get('status');
    const assigned_to = formData.get('assigned_to'); // Use assigned_to for consistency

    if (!serial_number || !service_type || !complaint_date || !complaint_summary || !status || !assigned_to) {
      return NextResponse.json({ error: 'Missing required form fields.' }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Handle file uploads
    const attachments = [];
    const files = formData.getAll('attachments'); // Use getAll for multiple files

    const uploadDirectory = path.join(process.cwd(), 'public', 'attachments'); // Store in public/attachments
    await fs.mkdir(uploadDirectory, { recursive: true }); // Ensure directory exists

    for (const file of files) {
      if (file.size > 0) { // Check if a file was actually uploaded
        const uniqueFilename = `${path.parse(file.name).name}_${Date.now()}_${Math.floor(Math.random() * 10000)}${path.parse(file.name).ext}`;
        const filePath = path.join(uploadDirectory, uniqueFilename);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);
        attachments.push(`/attachments/${uniqueFilename}`); // Store public path
      }
    }

    const attachmentsString = attachments.join(',');

    // Insert data into service_records table
    const [result] = await conn.execute(
      `INSERT INTO service_records (serial_number, service_type, complaint_date, complaint_summary, status, attachments, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [serial_number, service_type, complaint_date, complaint_summary, status, attachmentsString, assigned_to]
    );

    const serviceId = result.insertId;

    // Fetch installed_address and email from warranty_products
    const [warrantyRows] = await conn.execute(
      `SELECT installed_address, email, site_email FROM warranty_products WHERE serial_number = ?`,
      [serial_number]
    );

    let location = 'N/A';
    let recipientEmail = '';
    let siteEmail = '';

    if (warrantyRows.length > 0) {
      location = warrantyRows[0].installed_address || 'N/A';
      recipientEmail = warrantyRows[0].email || '';
      siteEmail = warrantyRows[0].site_email || '';
    }

    // Fetch assigned user's email from rep_list
    const [repRows] = await conn.execute(
      `SELECT email FROM rep_list WHERE username = ?`,
      [assigned_to]
    );

    const assignedEmail = repRows.length > 0 ? repRows[0].email : '';

    // Prepare recipient list (filtering out invalid emails)
    const toEmails = [recipientEmail, siteEmail, assignedEmail].filter(email =>
      email && typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );

    if (toEmails.length === 0) {
      console.warn('No valid recipient emails found for sending notification.');
      return NextResponse.json({ success: true, message: 'Complaint added, but no email sent due to invalid recipient addresses.' });
    }

    // Prepare template data
    const templateData = {
      service_id: serviceId,
      complaint_date,
      service_type,
      serial_number,
      location,
      complaint_summary,
      assigned_to,
      status,
      current_year: new Date().getFullYear(),
    };

    // Send email using template system
    await sendTemplatedEmail(
      'COMPLAINT',
      templateData,
      {
        to: toEmails.join(','),
        cc: 'service@dynacleanindustries.com',
        attachments: attachments.map(att => ({
          path: path.join(process.cwd(), 'public', att)
        })),
      }
    );

    // await conn.end();
    return NextResponse.json({ success: true, serviceId: serviceId });
  } catch (error) {
    console.error('Complaint submission failed:', error);
    return NextResponse.json({ error: 'Failed to submit complaint.' }, { status: 500 });
  }
}

// You might also want a GET route to fetch available users for the dropdown
export async function GET(req) {
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT username FROM rep_list WHERE userRole='SERVICE ENGINEER'`);
    // await conn.end();
    return NextResponse.json(rows.map(row => row.username));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
  }
}