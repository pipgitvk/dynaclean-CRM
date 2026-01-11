import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// POST - Update customer status and stage
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customer_id, stage } = body;

    if (!customer_id || !stage) {
      return NextResponse.json(
        { error: "customer_id and stage are required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    // Map stage to status for customers table
    let status = "New"; // default
    switch (stage) {
      case "New":
        status = "New";
        break;
      case "Contacted":
        status = "Contacted";
        break;
      case "Interested":
        status = "Interested";
        break;
      case "Demo Scheduled":
        status = "Demo Scheduled";
        break;
      case "Demo Completed":
        status = "Demo Completed";
        break;
      case "Qualified":
        status = "Qualified";
        break;
      case "Quotation Sent":
        status = "Proposal Sent";
        break;
      case "Quotation Revised":
        status = "Proposal Sent";
        break;
      case "Negotiation / Follow-up":
        status = "Negotiation";
        break;
      case "Decision Pending":
        status = "Decision Pending";
        break;
      case "Won (Order Received)":
        status = "Won";
        break;
      case "Lost":
        status = "Lost";
        break;
      case "Disqualified / Invalid Lead":
        status = "Disqualified";
        break;
      default:
        status = "New";
    }

    // Update customer status and stage
    await connection.execute(
      `UPDATE customers SET status = ?, stage = ? WHERE customer_id = ?`,
      [status, stage, customer_id]
    );

    return NextResponse.json({
      success: true,
      message: "Customer status and stage updated successfully"
    });
  } catch (error) {
    console.error("Error updating customer status:", error);
    return NextResponse.json(
      { error: "Failed to update customer status" },
      { status: 500 }
    );
  }
}
