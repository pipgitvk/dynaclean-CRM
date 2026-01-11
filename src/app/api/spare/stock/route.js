import { getDbConnection } from "@/lib/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";

export async function POST(req) {
    const formData = await req.formData();

    const spare_id = formData.get("spare_id"); // Updated column name
    const tax = formData.get("tax"); // Updated column name
    const from_company = formData.get("from_company");
    const quantity = Number(formData.get("quantity"));
    const amount_per_unit = Number(formData.get("amount_per_unit"));
    const net_amount = Number(formData.get("net_amount"));
    const note = formData.get("note");
    const location = formData.get("location");
    const added_date = formData.get("added_date");
    const godown = formData.get("godown"); 
    const godown_location = formData.get("godown_location"); 

    const file = formData.get("file");
    let filePathToStore = null;

    if (file) {
        // You'll need to fetch the spare part details to get a unique name
        // This is a placeholder for now, you might need to adjust based on your needs
        const uploadDir = path.join(process.cwd(), "public", "ADMIN", "STOCK");
        await fs.mkdir(uploadDir, { recursive: true });

        const ext = path.extname(file.name);
        const safeFilename = `${spare_id}_${Date.now()}${ext}`; // Using spare_id for filename
        const finalPath = path.join(uploadDir, safeFilename);

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(finalPath, fileBuffer);

        filePathToStore = `/ADMIN/STOCK/${safeFilename}`;
    }

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

    const conn = await getDbConnection();
    try {



const [rows] = await conn.execute(
  `SELECT total, delhi, south FROM stock_list 
   WHERE spare_id = ? 
   ORDER BY created_at DESC 
   LIMIT 1`,
  [spare_id]
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




        // Insert data into the new `stock_list` table
        await conn.execute(
            `INSERT INTO stock_list 
             (spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, added_date, from_company, supporting_file, added_by, godown, total, Delhi, South, godown_location) 
             VALUES (?, ?, ?, ?, ?, ?, 'IN', ?, ?, ?, ?,?, ?, ?, ?, ?)`,
            [
                spare_id,
                quantity,
                amount_per_unit,
                net_amount,
                note,
                location,
                added_date,
                from_company,
                filePathToStore,
                username,
                godown,
                totalD,
                delhiD,
                southD,
                godown_location
            ]
        );

        // Update or insert into the new `stock_summary` table
        const [summaryRows] = await conn.execute(
            "SELECT total_quantity, Delhi, South FROM stock_summary WHERE spare_id = ?",
            [spare_id]
        );

        if (summaryRows.length > 0) {
              const existingSummary = summaryRows[0];
  let newTotal = existingSummary.total_quantity + quantity;
  let newTotalDelhi = existingSummary.Delhi;
  let newTotalSouth = existingSummary.South;

  if (godown === "Delhi - Mundka") {
    newTotalDelhi += quantity;
  } else {
    newTotalSouth += quantity;
  }

            await conn.execute(
                `UPDATE stock_summary
                 SET last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?, last_status = 'IN', updated_at = NOW()
                 WHERE spare_id = ?`,
                [quantity, newTotal, newTotalDelhi, newTotalSouth, spare_id]
            );
        } else {
            let initialDelhi = 0;
  let initialSouth = 0;

  if (godown === "Delhi - Mundka") {
    initialDelhi = quantity;
  } else {
    initialSouth = quantity;
  }

            // Insert new record
            await conn.execute(
                `INSERT INTO stock_summary 
                 (spare_id, last_updated_quantity, total_quantity,Delhi, South, last_status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [spare_id, quantity, quantity, initialDelhi, initialSouth,"IN"]
            );
        }

        return new Response("Success", { status: 200 });
    } catch (error) {
        console.error("Database error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    } finally {
           
    }
}