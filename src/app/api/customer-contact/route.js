import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET - Fetch all contacts for a customer
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id");

    if (!customerId) {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    const [contacts] = await connection.execute(
      `SELECT 
        cc.id,
        cc.customer_id,
        cc.name,
        cc.contact,
        cc.designation,
        cc.report_to,
        cc.working,
        cc.created_at,
        cc.updated_at,
        rcc.name as report_to_name
      FROM customer_contact cc
      LEFT JOIN customer_contact rcc ON cc.report_to = rcc.id
      WHERE cc.customer_id = ?
      ORDER BY cc.created_at ASC`,
      [customerId]
    );

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

// POST - Create new contact
export async function POST(request) {
  try {
    const body = await request.json();
    const { customer_id, name, contact, designation, report_to, working } = body;

    if (!customer_id || !name) {
      return NextResponse.json(
        { error: "customer_id and name are required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    const [result] = await connection.execute(
      `INSERT INTO customer_contact (customer_id, name, contact, designation, report_to, working)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customer_id, name, contact || null, designation || null, report_to || null, working !== undefined ? working : 1]
    );

    return NextResponse.json({
      success: true,
      message: "Contact added successfully",
      contactId: result.insertId
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}

// PUT - Update contact
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, contact, designation, report_to, working } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: "id and name are required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    await connection.execute(
      `UPDATE customer_contact 
       SET name = ?, contact = ?, designation = ?, report_to = ?, working = ?
       WHERE id = ?`,
      [name, contact || null, designation || null, report_to || null, working !== undefined ? working : 1, id]
    );

    return NextResponse.json({
      success: true,
      message: "Contact updated successfully"
    });
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

// DELETE - Remove contact
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    await connection.execute(
      `DELETE FROM customer_contact WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: "Contact deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
