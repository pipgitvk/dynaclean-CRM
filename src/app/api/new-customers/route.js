import { getDbConnection } from "@/lib/db";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { convertISTtoUTC } from "@/lib/timezone";

const JWT_SECRET = process.env.JWT_SECRET;

const normalizePhone = (phone) => {
  if (!phone) return "";

  // Remove spaces, hyphens, brackets
  let cleaned = phone.replace(/[^\d]/g, "");

  // Take last 10 digits (Indian mobile standard)
  if (cleaned.length > 10) {
    cleaned = cleaned.slice(-10);
  }

  return cleaned;
};

export async function POST(req) {
  try {
    // ✅ Get token and verify
    const token = req.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    const createdby = payload.username;

    const data = await req.formData();
    const fields = Object.fromEntries(data.entries());

    // ✅ Handle visiting card uploads
    const cards = [];
    for (const key of ["card_front", "card_back"]) {
      const file = data.get(key);
      if (file && typeof file === "object" && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = path.extname(file.name);
        const filename =
          path.basename(file.name, ext).replace(/\s+/g, "_") +
          "_" +
          Date.now() +
          ext;
        const uploadPath = path.join("public", "visiting_cards", filename);
        await fs.promises.writeFile(uploadPath, buffer);
        cards.push(filename);
      }
    }
    // const visiting_card = cards.length ? cards.join(",") : null;
    const visiting_card = cards.length ? cards.join(",") : "";

    const now = new Date();
    // Convert IST datetime to UTC before storing
    const next_followup_date =
      convertISTtoUTC(fields.next_followup_date) || null;

    // ✅ Validate required fields
    const requiredFields = [
      "first_name",
      "phone",
      "products_interest",
      "tags",
      "communication_mode",
      "notes",
      "lead_campaign",
    ];
    for (const field of requiredFields) {
      if (!fields[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 },
        );
      }
    }

    console.log("✅ Creating new customer with fields:", fields);

    const conn = await getDbConnection();

    // ✅ Check for duplicate phone
    fields.phone = normalizePhone(fields.phone);

    if (fields.phone.length !== 10) {
      return NextResponse.json(
        { error: "Duplicate phone number" },
        { status: 400 },
      );
    }

    const [dupRows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM customers WHERE phone = ?`,
      [fields.phone],
    );
    if (dupRows[0].c > 0) {
      // await conn.end();
      return NextResponse.json(
        { error: "Duplicate phone number" },
        { status: 409 },
      );
    }

    // ✅ Insert into customers
    const [customerResult] = await conn.execute(
      `INSERT INTO customers (
        first_name, last_name, email, phone, address, company,
        lead_source, lead_campaign, status,
        followup_notes, communication_history, products_interest,
        sales_representative, assigned_to, tags, notes, gstin,
        next_follow_date, date_created, visiting_card
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fields.first_name,
        fields.last_name || "",
        fields.email || "",
        fields.phone,
        fields.address || "",
        fields.company || "",
        createdby,
        fields.lead_campaign || "Unknown",
        "New",
        fields.followup_notes || "",
        fields.communication_history || "",
        fields.products_interest,
        createdby,
        createdby,
        fields.tags,
        fields.notes,
        fields.gstin || "",
        next_followup_date || null,
        now,
        visiting_card,
      ],
    );

    const customerId = customerResult.insertId;

    // ✅ Insert into follow-up table
    await conn.execute(
      `INSERT INTO customers_followup (
        customer_id, name, contact, next_followup_date, followed_by,
        followed_date, communication_mode, notes, email
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        fields.first_name,
        fields.phone,
        next_followup_date,
        createdby,
        now,
        fields.communication_mode,
        fields.notes,
        fields.email || "",
      ],
    );

    // await conn.end();
    return NextResponse.json({ success: true, customerId });
  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
