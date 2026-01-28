// app/api/employees/[username]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(request, { params }) {
  try {
    const { username } = await params;
    const db = await getDbConnection();
    const [rows] = await db.query(
      "SELECT username, email, dob, number, address, state, userRole, profile_pic FROM rep_list WHERE username = ?",
      [username],
    );
    // db.end();

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Employee not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ employee: rows[0] });
  } catch (error) {
    console.error("Error fetching employee data:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { username } = params;
    const formData = await request.formData();

    const email = formData.get("email");
    const dob = formData.get("dob");
    const number = formData.get("number");
    const address = formData.get("address");
    const state = formData.get("state");
    const userRole = formData.get("userRole");
    const profilePic = formData.get("profile_pic");

    let profilePicPath = formData.get("current_profile_pic");
    let query = `
      UPDATE rep_list 
      SET email = ?, dob = ?, number = ?, address = ?, state = ?, userRole = ?
      WHERE username = ?
    `;
    let queryParams = [email, dob, number, address, state, userRole, username];

    if (profilePic && typeof profilePic !== "string") {
      const bytes = await profilePic.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Define the user-specific directory path
      const userDir = path.join(process.cwd(), "public", "employees", username);

      // Create the directory if it doesn't exist
      await mkdir(userDir, { recursive: true });

      // Use a fixed filename
      const filename = "profile.jpg";
      const filePath = path.join(userDir, filename);

      await writeFile(filePath, buffer);

      // Construct the database path with the fixed filename
      profilePicPath = `/employees/${username}/${filename}`;
      query = `
        UPDATE rep_list 
        SET email = ?, dob = ?, number = ?, address = ?, state = ?, userRole = ?, profile_pic = ? 
        WHERE username = ?
      `;
      queryParams = [
        email,
        dob,
        number,
        address,
        state,
        userRole,
        profilePicPath,
        username,
      ];
    }

    const db = await getDbConnection();
    const [result] = await db.query(query, queryParams);
    // db.end();

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Employee not found or no changes made." },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Employee updated successfully." });
  } catch (error) {
    console.error("Error updating employee data:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
