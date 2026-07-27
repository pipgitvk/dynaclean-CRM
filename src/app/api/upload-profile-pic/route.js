import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export async function POST(request) {
  let conn;
  try {
    const data = await request.formData();
    const file = data.get("profileImage");
    const username = data.get("username");

    if (!file || !username) {
      return NextResponse.json({ error: "No image or username provided" }, { status: 400 });
    }

    // Convert the file to a buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Define the destination path
    const uploadDir = path.join(process.cwd(), "public", "employees", username);
    const filename = `profile.jpg`; // Standardize the filename
    const filePath = path.join(uploadDir, filename);

    // Create the directory if it doesn't exist
    await fs.mkdir(uploadDir, { recursive: true });

    // Write the file to the specified path
    await fs.writeFile(filePath, buffer);

    // Update database
    const pool = await getDbConnection();
    conn = await pool.getConnection();
    const query = `UPDATE rep_list SET profile_pic = ? WHERE username = ?`;
    await conn.execute(query, [`/employees/${username}/${filename}`, username]);

    return NextResponse.json({
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Failed to upload file." }, { status: 500 });
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
}