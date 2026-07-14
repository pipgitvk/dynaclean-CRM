import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import nodemailer from "nodemailer";
import path from "path";
import { readFile } from "fs/promises";

/**
 * Send employment confirmation letter email to both personal and professional email
 * POST /api/empcrm/profile/send-confirmation-email
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, professional_email, full_name, confirmationLetterPath } = body;

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

    // Prepare email content
    const emailSubject = `Employment Confirmation Letter - ${full_name || username}`;
    
    const emailHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Employment Confirmation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #0066cc;
            margin: 0;
            font-size: 24px;
          }
          .content {
            margin-bottom: 20px;
          }
          .greeting {
            font-size: 16px;
            margin-bottom: 15px;
          }
          .message {
            background-color: #e8f4f8;
            border-left: 4px solid #0066cc;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #777;
            border-top: 1px solid #ddd;
            padding-top: 20px;
            margin-top: 30px;
          }
          .attachment-notice {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            padding: 12px;
            border-radius: 4px;
            margin: 15px 0;
            font-size: 14px;
          }
          .company-name {
            color: #0066cc;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Employment Confirmation</h1>
          </div>
          
          <div class="content">
            <div class="greeting">
              Dear <strong>${full_name || username}</strong>,
            </div>
            
            <p>We are pleased to confirm that your employment status has been updated to <strong>Permanent</strong> in our system.</p>
            
            <div class="message">
              <strong>Employment Status Update:</strong><br>
              Your permanent employment confirmation letter is attached to this email. Please keep this for your records.
            </div>
            
            <div class="attachment-notice">
              📎 <strong>Attachment:</strong> Please review the attached Employment Confirmation Letter document. This document serves as official confirmation of your permanent employment.
            </div>
            
            <p>If you have any questions regarding your employment status or the confirmation letter, please feel free to contact our HR department.</p>
            
            <p>Thank you for your continued dedication to <span class="company-name">Dynaclean Industries</span>.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email from HR Management System. Please do not reply directly to this email.</p>
            <p>&copy; 2026 Dynaclean Industries. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

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
      const [profileData] = await conn.execute(
        `SELECT reporting_manager FROM employee_profiles WHERE username = ?`,
        [username]
      );
      
      if (profileData.length > 0 && profileData[0].reporting_manager) {
        const reportingManagerName = profileData[0].reporting_manager;
        // Query to find reporting manager's email
        const [managerData] = await conn.execute(
          `SELECT email, professional_email FROM employee_profiles WHERE full_name = ? OR username = ? LIMIT 1`,
          [reportingManagerName, reportingManagerName]
        );
        
        if (managerData.length > 0) {
          reportingManagerEmail = managerData[0].professional_email || managerData[0].email;
          console.log(`✅ Found reporting manager email: ${reportingManagerEmail}`);
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
