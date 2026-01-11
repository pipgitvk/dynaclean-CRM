// src/app/api/update-report/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const serviceId = formData.get("serviceId");
    const status = formData.get("status");
    const image = formData.get("image");

    if (!serviceId || !status || !image) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const fileName = `${Date.now()}-${image.name}`;
    let folderPath;
    let filePath;
    let dbColumnName;

    // Determine the folder and database column based on the status
    if (status === "COMPLETED") {
      folderPath = path.join(process.cwd(), "public", "Final", "record");
      dbColumnName = "final_report_path";
    } else if (status === "PENDING FOR SPARES") {
      folderPath = path.join(process.cwd(), "public", "Final", "reports");
      dbColumnName = "report_path";
    } else {
      return NextResponse.json({ error: "Invalid status provided" }, { status: 400 });
    }

    // Create the directory if it doesn't exist
    await mkdir(folderPath, { recursive: true });

    filePath = path.join(folderPath, fileName);
    // Save the file to the public folder
    await writeFile(filePath, buffer);

    // Construct the public path to save in the database
    const publicPath = `/Final/${status === "COMPLETED" ? "record" : "reports"}/${fileName}`;

    const conn = await getDbConnection();

    // Start building the SQL query
    let sql = `
      UPDATE service_records 
      SET ${dbColumnName} = ?, status = ?
    `;
    const params = [publicPath, status];

    // Conditionally add the completed_date to the query and parameters
    if (status === "COMPLETED") {
      sql += `, completed_date = CURDATE()`;
    }

    // Add the WHERE clause and the final parameter
    sql += ` WHERE service_id = ?`;
    params.push(serviceId);

    // Execute the single query
    await conn.execute(sql, params);
    conn.end();

    return NextResponse.json({ message: "Report updated successfully", publicPath }, { status: 200 });
  } catch (error) {
    console.error("Booking Upload Error:", error);
    return NextResponse.json({ error: "Failed to upload report." }, { status: 500 });
  }
}