


import { getDbConnection } from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";

export async function POST(req) {
  const formData = await req.formData();

  // Extract form fields
  const product_code = formData.get("product_code");
  const hsn = formData.get("hsn");
  const gst = formData.get("gst");
  const from_company = formData.get("from_company");
  const quantity = Number(formData.get("quantity"));
  const amount_per_unit = Number(formData.get("amount_per_unit"));
  const net_amount = Number(formData.get("net_amount"));
  const note = formData.get("note");
  const location = formData.get("location");
  const godown = formData.get("godown"); // Extract the new godown field
  const added_date = formData.get("added_date");

  // Get file from form data (if present)
  const file = formData.get("file");

  let filePathToStore = null;

  // If a file is uploaded, process it
  if (file) {
    const uploadDir = path.join(process.cwd(), "public", "ADMIN", "STOCK");
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name); // Get the file extension
    const safeFilename = `${product_code}_${Date.now()}${ext}`; // Generate a safe filename
    const finalPath = path.join(uploadDir, safeFilename); // Final path to store the file

    const fileBuffer = Buffer.from(await file.arrayBuffer()); // Convert file to buffer
    await fs.writeFile(finalPath, fileBuffer); // Write file to disk

    filePathToStore = `/ADMIN/STOCK/${safeFilename}`; // Save the relative path to the database
  }

  // Decode JWT
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;
  let username = "Unknown";

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      username = decoded.username || "Unknown";
    } catch (error) {
      console.error("JWT decode failed", error);
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), { status: 401 });
    }
  }

  // DB logic
  const conn = await getDbConnection();

const [rows] = await conn.execute(
  `SELECT total, delhi, south FROM product_stock 
   WHERE product_code = ? 
   ORDER BY created_at DESC 
   LIMIT 1`,
  [product_code]
);

// Initialize base values
let totalDB = 0;
let delhiDB = 0;
let southDB = 0;

if (rows.length > 0) {
  totalDB = rows[0].total ;
  delhiDB = rows[0].delhi ;
  southDB = rows[0].south ;
}

// 2. Compute updated values

let delhiD = delhiDB;
let southD = southDB;

if (godown === "Delhi - Mundka") {
  delhiD = delhiDB + quantity;
  southD = southDB;
} else {
  southD = southDB + quantity;
  delhiD = delhiDB;
}

let totalD = totalDB + quantity;

// 3. Insert new record
await conn.execute(
  `INSERT INTO product_stock 
    (product_code, quantity, amount_per_unit, net_amount, note, location, stock_status, from_company, gst, hs_code, added_by, supporting_file, added_date, godown, total, delhi, south) 
    VALUES (?, ?, ?, ?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    product_code,
    quantity,
    amount_per_unit,
    net_amount,
    note,
    location,
    from_company,
    gst,
    hsn,
    username,
    filePathToStore || null,
    added_date ? new Date(added_date) : new Date(),
    godown,
    totalD,
    delhiD,
    southD
  ]
);


const [summaryRows] = await conn.execute(
  "SELECT total_quantity, Delhi, South FROM product_stock_summary WHERE product_code = ?",
  [product_code]
);

if (summaryRows.length > 0) {
  // Step 2: If the product exists, get the current values
  const existingSummary = summaryRows[0];
  let newTotal = existingSummary.total_quantity + quantity;
  let newTotalDelhi = existingSummary.Delhi;
  let newTotalSouth = existingSummary.South;

  if (godown === "Delhi - Mundka") {
    newTotalDelhi += quantity;
  } else {
    newTotalSouth += quantity;
  }

  // Step 3: Correct the UPDATE statement with the right number of placeholders and values
  await conn.execute(
    `UPDATE product_stock_summary
      SET last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?, last_status = 'IN', updated_at = NOW()
      WHERE product_code = ?`,
    [quantity, newTotal, newTotalDelhi, newTotalSouth, product_code]
  );
} else {
  // Step 4: If the product does not exist, insert a new entry
  let initialDelhi = 0;
  let initialSouth = 0;

  if (godown === "Delhi - Mundka") {
    initialDelhi = quantity;
  } else {
    initialSouth = quantity;
  }

  // Step 5: Correct the INSERT statement
  await conn.execute(
    `INSERT INTO product_stock_summary
      (product_code, last_updated_quantity, total_quantity, Delhi, South, last_status)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [product_code, quantity, quantity, initialDelhi, initialSouth, 'IN']
  );
}

      // await conn.end(); // Close the database connection

  return new Response("Success", { status: 200 }); // Return success response
}