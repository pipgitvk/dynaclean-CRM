import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const body = await request.json();
    const {
      delivery_challan_for,
      delivery_challan_for_address,
      delivery_challan_for_gstin,
      ship_to,
      ship_to_address,
      ship_to_gstin,
      transportation_details,
      expected_delivery_date,
      delivery_date,
      delivery_location,
      challan_no,
      challan_date,
      eway_bill,
      items,
      remarks,
    } = body;

    const conn = await getDbConnection();

    // Create tables if they don't exist
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS delivery_challans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        delivery_challan_for VARCHAR(255),
        ship_to VARCHAR(255),
        transportation_details TEXT,
        delivery_date DATE,
        delivery_location VARCHAR(255),
        challan_no VARCHAR(255),
        challan_date DATE,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Add remarks column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN remarks TEXT`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add eway_bill column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN eway_bill VARCHAR(255)`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add delivery_challan_for_address column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN delivery_challan_for_address TEXT`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add ship_to_address column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN ship_to_address TEXT`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add delivery_challan_for_gstin column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN delivery_challan_for_gstin VARCHAR(255)`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add ship_to_gstin column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN ship_to_gstin VARCHAR(255)`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    // Add expected_delivery_date column if it doesn't exist
    try {
      await conn.execute(`ALTER TABLE delivery_challans ADD COLUMN expected_delivery_date DATE`);
    } catch (err) {
      // Column might already exist, ignore error
    }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS delivery_challan_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        delivery_challan_id INT,
        product_code VARCHAR(255),
        product_name VARCHAR(255),
        product_hsn VARCHAR(255),
        product_specification TEXT,
        product_unit VARCHAR(255),
        product_price DECIMAL(10,2),
        product_quantity INT DEFAULT 1,
        product_image VARCHAR(255),
        FOREIGN KEY (delivery_challan_id) REFERENCES delivery_challans(id) ON DELETE CASCADE
      )
    `);

    // Insert delivery challan
    const [result] = await conn.execute(
      `INSERT INTO delivery_challans 
        (delivery_challan_for, delivery_challan_for_address, delivery_challan_for_gstin, ship_to, ship_to_address, ship_to_gstin, transportation_details, expected_delivery_date, challan_no, challan_date, eway_bill, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        delivery_challan_for,
        delivery_challan_for_address,
        delivery_challan_for_gstin,
        ship_to,
        ship_to_address,
        ship_to_gstin,
        transportation_details,
        expected_delivery_date,
        challan_no,
        challan_date,
        eway_bill,
        remarks,
      ]
    );

    const deliveryChallanId = result.insertId;

    // Insert delivery challan items
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await conn.execute(
          `INSERT INTO delivery_challan_items 
            (delivery_challan_id, product_code, product_name, product_hsn, product_specification, product_unit, product_price, product_quantity, product_image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deliveryChallanId,
            item.productCode,
            item.name,
            item.hsn,
            item.specification,
            item.unit,
            item.price,
            item.quantity,
            item.imageUrl,
          ]
        );
      }
    }

    return NextResponse.json(
      { success: true, id: result.insertId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating delivery challan:", error);
    return NextResponse.json(
      { error: "Failed to create delivery challan" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const conn = await getDbConnection();

    const [rows] = await conn.execute(`
      SELECT * FROM delivery_challans 
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching delivery challans:", error);
    return NextResponse.json(
      { error: "Failed to fetch delivery challans" },
      { status: 500 }
    );
  }
}
