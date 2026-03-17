import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import { checkPhoneDuplicate, normalizePhone } from "@/lib/phone-check";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    const createdby = payload.username;

    const body = await req.json();
    const {
      parent_customer_id,
      first_name,
      last_name = "",
      phone,
      email = "",
      company = "",
      designation = "",
      address = "",
      products_interest = "",
      tags = "",
      notes = "",
      report_to = null,
      working = 1,
      contact_status = null,
    } = body;

    if (!parent_customer_id || !first_name || !phone) {
      return NextResponse.json(
        { error: "parent_customer_id, first_name and phone are required" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length !== 10) {
      return NextResponse.json(
        { error: "Invalid phone number (must be 10 digits)" },
        { status: 400 }
      );
    }

    const dupCheck = await checkPhoneDuplicate(normalizedPhone);
    if (dupCheck.duplicate) {
      return NextResponse.json(
        {
          error: "Duplicate phone number",
          duplicate: true,
          source: dupCheck.source,
          existingCustomerId: dupCheck.customerId,
        },
        { status: 409 }
      );
    }

    const conn = await getDbConnection();
    const now = new Date();

    try {
      await conn.execute("SELECT parent_customer_id FROM customers LIMIT 1");
    } catch (_) {
      try {
        await conn.execute(
          "ALTER TABLE customers ADD COLUMN parent_customer_id INT NULL"
        );
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT report_to FROM customers LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE customers ADD COLUMN report_to INT NULL");
        await conn.execute("ALTER TABLE customers ADD COLUMN working TINYINT(1) DEFAULT 1");
        await conn.execute("ALTER TABLE customers ADD COLUMN designation VARCHAR(100) NULL");
        await conn.execute("ALTER TABLE customers ADD COLUMN contact_status VARCHAR(50) NULL");
      } catch (__) {}
    }

    const [customerResult] = await conn.execute(
      `INSERT INTO customers (
        parent_customer_id, first_name, last_name, email, phone, address, company,
        lead_source, lead_campaign, status,
        followup_notes, communication_history, products_interest,
        sales_representative, assigned_to, tags, notes, gstin,
        next_follow_date, date_created, designation, report_to, working, contact_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parent_customer_id,
        first_name,
        last_name,
        email,
        normalizedPhone,
        address,
        company,
        createdby,
        "member",
        "New",
        notes,
        "",
        products_interest || "",
        createdby,
        createdby,
        tags || "",
        notes,
        "",
        null,
        now,
        designation || null,
        report_to || null,
        working !== undefined ? (working ? 1 : 0) : 1,
        contact_status || null,
      ]
    );

    const newCustomerId = customerResult.insertId;

    await conn.execute(
      `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date, followed_by,
        followed_date, communication_mode, notes, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newCustomerId,
        first_name,
        normalizedPhone,
        null,
        createdby,
        now,
        "Manual",
        `Member contact added from parent customer ${parent_customer_id}`,
        email,
      ]
    );

    return NextResponse.json({
      success: true,
      customerId: newCustomerId,
      message: "Member customer added successfully",
    });
  } catch (error) {
    console.error("add-member-customer error:", error);
    return NextResponse.json(
      { error: "Failed to add member customer" },
      { status: 500 }
    );
  }
}
