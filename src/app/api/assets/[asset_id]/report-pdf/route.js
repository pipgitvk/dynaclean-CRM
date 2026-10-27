// src/app/api/assets/[asset_id]/report-pdf/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";

export async function GET(request, { params }) {
  // Await params to ensure it's resolved before using
  const { asset_id } = await params;
  let conn = null;

  try {
    conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT a.asset_name, aa.Assigned_to, aa.Assigned_by, aa.Assigned_Date
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.asset_id
       WHERE aa.asset_id = ?
       ORDER BY aa.Assigned_Date DESC
       LIMIT 1`,
      [asset_id]
    );

    const assignment = rows[0];

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found." },
        { status: 404 }
      );
    }

    // Load the image (company logo)
    const logoUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/images/logo.png`; // Replace with actual image URL or path
    console.log("Fetching logo from:", logoUrl);
    const imageResponse = await fetch(logoUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to load image from URL: ${logoUrl}`);
    }

    const logoBytes = await imageResponse.arrayBuffer();

    // Log the content type for debugging
    const contentType = imageResponse.headers.get('Content-Type');
    console.log("Image Content-Type:", contentType);

    if (!contentType || !contentType.includes("image/png")) {
      throw new Error("The input is not a PNG file!");
    }

    // Create a PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 750]);
    const { width, height } = page.getSize();

    // Embed the image
    console.log("Embedding the image into the PDF...");
    const logoImage = await pdfDoc.embedPng(logoBytes);

    const logoWidth = 100; // Set your desired logo width
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth; // Maintain aspect ratio
    page.drawImage(logoImage, {
      x: 50, // X position
      y: height - logoHeight - 50, // Y position (just below the header)
      width: logoWidth,
      height: logoHeight,
    });

    // Draw the title
    console.log("Adding title to the PDF...");
    page.drawText("Asset Submission Report", {
      x: 50,
      y: height - logoHeight - 80, // Adjust for the space occupied by the logo
      size: 24,
      color: rgb(0, 0, 0),
    });

    // Prepare the text content
    const textContent = `
      Asset ID: ${asset_id}
      Asset Name: ${assignment.asset_name}
      Assigned To: ${assignment.Assigned_to}
      Assigned By: ${assignment.Assigned_by}
      Assigned Date: ${new Date(
        assignment.Assigned_Date
      ).toLocaleDateString()}
      
      ---------------------------------------------------------
      
      I, the undersigned, acknowledge that the above-mentioned asset is
      being submitted in its current condition. I confirm that all
      associated items and accessories are included.

      Signature of Submitter: _________________________

      Date: _________________________

      ---------------------------------------------------------
      
      Additional Notes (Please write any comments below):

      _________________________________________________________
      
      _________________________________________________________
      
      _________________________________________________________
    `;

    // Draw the text content on the page
    console.log("Adding text content to the PDF...");
    page.drawText(textContent, {
      x: 50,
      y: height - logoHeight - 150, // Adjust Y position for the content below the title
      size: 12,
      lineHeight: 20,
      color: rgb(0, 0, 0),
    });

    // Save the generated PDF
    console.log("Saving the PDF...");
    const pdfBytes = await pdfDoc.save();

    // Send the PDF as a response
    console.log("Sending the PDF as a response...");
    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="asset-report-${asset_id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("❌ Error generating PDF:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  } finally {
     console.log(`[GET] DB connection closed`);
  }
}
