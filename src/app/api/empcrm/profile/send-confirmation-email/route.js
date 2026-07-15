import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import nodemailer from "nodemailer";
import path from "path";
import { readFile } from "fs/promises";
import { buildEmploymentConfirmationEmail } from "@/lib/emailTemplates/employmentConfirmationBuilder";

/**
 * Send employment confirmation letter email to both personal and professional email
 * POST /api/empcrm/profile/send-confirmation-email
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, professional_email, full_name, confirmationLetterPath, confirmation_letter_link } = body;

    if (!username || (!email && !professional_email)) {
      return NextResponse.json(
        { success: false, error: "Username and at least one email address required" },
        { status: 400 }
      );
    }

    // Get SMTP credentials from environment
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const senderEmail = process.env.SMTP_FROM || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error("Missing SMTP configuration");
      return NextResponse.json(
        { success: false, error: "Email service not configured" },
        { status: 500 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    // Fetch employee details from database
    const conn = await getDbConnection();
    const [employeeData] = await conn.execute(
      `SELECT 
        ep.designation, 
        ep.department, 
        ep.date_of_joining,
        ep.reporting_manager 
       FROM employee_profiles ep 
       WHERE ep.username = ? LIMIT 1`,
      [username]
    );

    if (!employeeData || employeeData.length === 0) {
      console.warn(`Employee profile not found for username: ${username}`);
    }

    const employee = employeeData?.[0] || {};
    
    // Format dates
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).split('/').reverse().join('-');
    };

    // Build confirmation email using template
    const confirmationData = {
      employee_name: full_name || username,
      employee_id: username,
      designation: employee.designation || 'N/A',
      department: employee.department || 'N/A',
      joining_date: formatDate(employee.date_of_joining),
      confirmation_date: formatDate(new Date()),
      confirmation_letter_link: confirmation_letter_link || '#',
      current_year: new Date().getFullYear(),
    };

    const emailHTML = buildEmploymentConfirmationEmail(confirmationData);
    const emailSubject = `Employment Confirmation - DynaClean Industries`;

    // Collect emails to send to
    const recipientEmails = [];
    if (email && email.trim()) recipientEmails.push(email);
    if (professional_email && professional_email.trim() && professional_email !== email) {
      recipientEmails.push(professional_email);
    }

    if (recipientEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid email addresses provided" },
        { status: 400 }
      );
    }

    // Get reporting manager email
    let reportingManagerEmail = null;
    try {
      const conn = await getDbConnection();

      // Step 1: Get reporting_manager username from rep_list
      const [empRows] = await conn.execute(
        `SELECT reporting_manager FROM rep_list WHERE username = ? LIMIT 1`,
        [username]
      );

      if (empRows.length > 0 && empRows[0].reporting_manager) {
        const managerUsername = empRows[0].reporting_manager;

        // Step 2: Get manager's email from rep_list
        const [managerRows] = await conn.execute(
          `SELECT email FROM rep_list WHERE username = ? LIMIT 1`,
          [managerUsername]
        );

        if (managerRows.length > 0 && managerRows[0].email) {
          reportingManagerEmail = managerRows[0].email;
          console.log(`✅ Found reporting manager (${managerUsername}) email: ${reportingManagerEmail}`);
        }
      }
    } catch (err) {
      console.warn("Could not fetch reporting manager email:", err.message);
    }

    // Prepare attachments
    const attachments = [];
    if (confirmationLetterPath) {
      try {
        const filePath = path.join(process.cwd(), "public", confirmationLetterPath.replace(/^\/public\//, ""));
        const fileBuffer = await readFile(filePath);
        attachments.push({
          filename: "Employment_Confirmation_Letter.pdf",
          content: fileBuffer,
          contentType: "application/pdf",
        });
      } catch (err) {
        console.warn("Could not attach confirmation letter:", err.message);
      }
    }

    // Send email to all recipients
    const emailResults = [];
    for (const recipientEmail of recipientEmails) {
      try {
        const mailOptions = {
          from: senderEmail,
          to: recipientEmail,
          subject: emailSubject,
          html: emailHTML,
          attachments: attachments,
        };
        
        // Add reporting manager to CC if available
        if (reportingManagerEmail && reportingManagerEmail !== recipientEmail) {
          mailOptions.cc = reportingManagerEmail;
        }
        
        const result = await transporter.sendMail(mailOptions);

        emailResults.push({
          email: recipientEmail,
          success: true,
          messageId: result.messageId,
          cc: reportingManagerEmail || null,
        });

        console.log(`✅ Confirmation email sent to ${recipientEmail}${reportingManagerEmail ? ` (CC: ${reportingManagerEmail})` : ''}`);
      } catch (err) {
        console.error(`❌ Failed to send email to ${recipientEmail}:`, err);
        emailResults.push({
          email: recipientEmail,
          success: false,
          error: err.message,
        });
      }
    }

    // Check if at least one email was sent successfully
    const successCount = emailResults.filter((r) => r.success).length;
    if (successCount === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to send emails to any recipient", results: emailResults },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Confirmation email sent to ${successCount} recipient(s)`,
      results: emailResults,
    });
  } catch (error) {
    console.error("[EMPCRM] Send confirmation email error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
