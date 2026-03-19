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

    let contacts = memberRows || [];

    // When viewing a contact who has a parent, include full ancestor chain + current
    // e.g. Vaccum Cleaners → show Ravindra → shalini → Vaccum Cleaners
    const [currentRows] = await connection.execute(
      `SELECT c.customer_id, c.parent_customer_id, c.first_name, c.last_name, c.phone, c.designation, COALESCE(c.working, 1) as working
       FROM customers c WHERE c.customer_id = ?`,
      [customerId],
    );
    const currentCustomer = currentRows?.[0];
    if (currentCustomer?.parent_customer_id) {
      // Walk up parent_customer_id chain to get full ancestor list (root first)
      const ancestors = [];
      let pid = currentCustomer.parent_customer_id;
      const seen = new Set();
      while (pid && !seen.has(pid)) {
        seen.add(pid);
        const [pRows] = await connection.execute(
          `SELECT customer_id, parent_customer_id, first_name, last_name, phone, designation, COALESCE(working, 1) as working
           FROM customers WHERE customer_id = ?`,
          [pid],
        );
        const p = pRows?.[0];
        if (!p) break;
        ancestors.unshift(p); // add at start so root comes first
        pid = p.parent_customer_id;
      }
      const currentName = [currentCustomer.first_name, currentCustomer.last_name].filter(Boolean).join(" ").trim() || "Unnamed";
      const ancestorContacts = ancestors.map((a, i) => {
        const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || "Unnamed";
        const prevId = i === 0 ? null : ancestors[i - 1].customer_id;
        const reportToName = i === 0 ? null : [ancestors[i - 1].first_name, ancestors[i - 1].last_name].filter(Boolean).join(" ").trim() || "Unnamed";
        return {
          id: a.customer_id,
          customer_id: a.customer_id,
          name,
          contact: a.phone || "",
          designation: a.designation || null,
          report_to: prevId,
          working: a.working ?? 1,
          report_to_name: reportToName,
          created_at: null,
          updated_at: null,
        };
      });
      const immediateParent = ancestors[ancestors.length - 1];
      const immediateParentName = immediateParent ? [immediateParent.first_name, immediateParent.last_name].filter(Boolean).join(" ").trim() || "Unnamed" : null;
      const currentContact = {
        id: currentCustomer.customer_id,
        customer_id: currentCustomer.customer_id,
        name: currentName,
        contact: currentCustomer.phone || "",
        designation: currentCustomer.designation || null,
        report_to: immediateParent?.customer_id ?? null,
        working: currentCustomer.working ?? 1,
        report_to_name: immediateParentName,
        created_at: null,
        updated_at: null,
      };
      contacts = [...ancestorContacts, currentContact, ...contacts];
    }
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

    // Inherit lead_source from parent customer (child contacts inherit parent's lead source)
    const [parentRows] = await connection.execute(
      `SELECT lead_source FROM customers WHERE customer_id = ?`,
      [customer_id],
    );
    const parentLeadSource = parentRows?.[0]?.lead_source || "Manual";

    const now = new Date();
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
        parentLeadSource,
        "member",
        "New",
        "",
        "",
        "",
        parentLeadSource,
        parentLeadSource,
        "",
        "",
        "",
        null,
        now,
        designationVal,
        reportToId,
        workingVal,
        contactStatusVal,
      ],
    );

    const newCustomerId = result.insertId;

    // Insert into customers_followup so Follow-up page finds the contact
    await connection.execute(
      `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date, followed_by,
        followed_date, communication_mode, notes, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newCustomerId,
        first_name,
        phone,
        null,
        "Manual",
        now,
        "Manual",
        `Contact added from parent customer ${customer_id}`,
        "",
      ],
    );

    return NextResponse.json({
      success: true,
      message: "Contact added successfully",
      contactId: newCustomerId,
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
