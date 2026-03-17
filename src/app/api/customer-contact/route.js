import { NextResponse } from "next/server"; 
import { getDbConnection } from "@/lib/db";
import { checkPhoneDuplicate, normalizePhone } from "@/lib/phone-check";

// GET - Fetch all contacts for a customer (from customers table - report_to, working, designation in same table)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id") || searchParams.get("customerId");

    if (!customerId || customerId === "undefined" || customerId === "null") {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400 },
      );
    }

    const connection = await getDbConnection();

    try {
      await connection.execute("SELECT parent_customer_id FROM customers LIMIT 1");
    } catch (_) {
      try {
        await connection.execute("ALTER TABLE customers ADD COLUMN parent_customer_id INT NULL");
      } catch (__) {}
    }
    try {
      await connection.execute("SELECT report_to FROM customers LIMIT 1");
    } catch (_) {
      try {
        await connection.execute("ALTER TABLE customers ADD COLUMN report_to INT NULL");
        await connection.execute("ALTER TABLE customers ADD COLUMN working TINYINT(1) DEFAULT 1");
        await connection.execute("ALTER TABLE customers ADD COLUMN designation VARCHAR(100) NULL");
        await connection.execute("ALTER TABLE customers ADD COLUMN contact_status VARCHAR(50) NULL");
      } catch (__) {}
    }

    // Fetch member customers (contacts) from customers table with report_to, working, designation
    const [memberRows] = await connection.execute(
      `SELECT 
        c.customer_id as id,
        c.customer_id,
        c.first_name,
        c.last_name,
        CONCAT(TRIM(c.first_name), ' ', TRIM(COALESCE(c.last_name, ''))) as name,
        c.phone as contact,
        c.designation,
        c.report_to,
        COALESCE(c.working, 1) as working,
        c.date_created as created_at,
        c.date_created as updated_at,
        CONCAT(TRIM(rc.first_name), ' ', TRIM(COALESCE(rc.last_name, ''))) as report_to_name
      FROM customers c
      LEFT JOIN customers rc ON c.report_to = rc.customer_id
      WHERE c.parent_customer_id = ?
      ORDER BY c.date_created ASC`,
      [customerId],
    );

    const contacts = memberRows || [];
    const memberCustomers = memberRows?.map((r) => ({
      customer_id: r.customer_id,
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      phone: r.contact,
      email: null,
      company: null,
      date_created: r.created_at,
    })) || [];

    return NextResponse.json({ success: true, contacts, memberCustomers });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
}

// POST - Create new contact (adds to customers table with parent_customer_id, report_to, working)
export async function POST(request) {
  try {
    const body = await request.json();
    const { customer_id, name, contact, designation, report_to, working } = body;

    if (!customer_id || !name) {
      return NextResponse.json(
        { error: "customer_id and name are required" },
        { status: 400 },
      );
    }

    const phone = contact ? normalizePhone(contact) : "";
    if (!phone || phone.length !== 10) {
      return NextResponse.json(
        { error: "Valid 10-digit phone number is required" },
        { status: 400 },
      );
    }

    const dupCheck = await checkPhoneDuplicate(phone);
    if (dupCheck.duplicate) {
      return NextResponse.json(
        {
          error: "Duplicate phone number",
          duplicate: true,
          source: dupCheck.source,
          existingCustomerId: dupCheck.customerId,
        },
        { status: 409 },
      );
    }

    const connection = await getDbConnection();

    try {
      await connection.execute("SELECT report_to FROM customers LIMIT 1");
    } catch (_) {
      try {
        await connection.execute("ALTER TABLE customers ADD COLUMN report_to INT NULL");
        await connection.execute("ALTER TABLE customers ADD COLUMN working TINYINT(1) DEFAULT 1");
        await connection.execute("ALTER TABLE customers ADD COLUMN designation VARCHAR(100) NULL");
        await connection.execute("ALTER TABLE customers ADD COLUMN contact_status VARCHAR(50) NULL");
      } catch (__) {}
    }

    const nameParts = String(name).trim().split(/\s+/);
    const first_name = nameParts[0] || "";
    const last_name = nameParts.slice(1).join(" ") || "";
    const reportToId = report_to != null && report_to !== ""
      ? (typeof report_to === "number" ? report_to : (parseInt(report_to, 10) || null))
      : null;

    const designationVal = (designation != null && String(designation).trim()) ? String(designation).trim() : null;
    const workingVal = working !== undefined && working !== null ? (working ? 1 : 0) : 1;
    const contactStatusVal = workingVal ? "Working" : "Not Working";

    const [result] = await connection.execute(
      `INSERT INTO customers (
        parent_customer_id, first_name, last_name, email, phone, address, company,
        lead_source, lead_campaign, status,
        followup_notes, communication_history, products_interest,
        sales_representative, assigned_to, tags, notes, gstin,
        next_follow_date, date_created, designation, report_to, working, contact_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id,
        first_name,
        last_name,
        "",
        phone,
        "",
        "",
        "Manual",
        "member",
        "New",
        "",
        "",
        "",
        "Manual",
        "Manual",
        "",
        "",
        "",
        null,
        new Date(),
        designationVal,
        reportToId,
        workingVal,
        contactStatusVal,
      ],
    );

    return NextResponse.json({
      success: true,
      message: "Contact added successfully",
      contactId: result.insertId,
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    const msg = error?.message || "Failed to create contact";
    return NextResponse.json(
      { error: "Failed to create contact", detail: msg },
      { status: 500 },
    );
  }
}

// PUT - Update contact (updates customers table - report_to, working, designation)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, contact, designation, report_to, working } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id (customer_id) is required" },
        { status: 400 },
      );
    }

    const connection = await getDbConnection();

    const nameParts = name ? String(name).trim().split(/\s+/) : [];
    const first_name = nameParts[0] || "";
    const last_name = nameParts.slice(1).join(" ") || "";

    await connection.execute(
      `UPDATE customers 
       SET first_name = ?, last_name = ?, phone = ?, designation = ?, report_to = ?, working = ?
       WHERE customer_id = ?`,
      [
        first_name,
        last_name,
        contact || null,
        designation || null,
        report_to || null,
        working !== undefined ? (working ? 1 : 0) : 1,
        id,
      ],
    );

    return NextResponse.json({
      success: true,
      message: "Contact updated successfully",
    });
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 },
    );
  }
}

// DELETE - Remove contact (unlinks customer by setting parent_customer_id = NULL)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id (customer_id) is required" }, { status: 400 });
    }

    const connection = await getDbConnection();

    await connection.execute(
      `UPDATE customers SET parent_customer_id = NULL, report_to = NULL WHERE customer_id = ?`,
      [id],
    );

    return NextResponse.json({
      success: true,
      message: "Contact removed successfully",
    });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 },
    );
  }
}
