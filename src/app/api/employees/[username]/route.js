// app/api/employees/[username]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { renameRepListUsername } from "@/lib/renameRepListUsername";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

async function requireAdminOrSuperadmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    const role = payload?.role || "";
    if (!["ADMIN", "SUPERADMIN"].includes(role)) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
    return {};
  } catch {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
}

export async function GET(request, { params }) {
  const auth = await requireAdminOrSuperadmin();
  if (auth.error) return auth.error;

  try {
    const { username } = await params;
    const db = await getDbConnection();
    const [rows] = await db.query(
      "SELECT username, email, dob, number, address, state, userRole, profile_pic FROM rep_list WHERE username = ?",
      [username],
    );

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
  const auth = await requireAdminOrSuperadmin();
  if (auth.error) return auth.error;

  try {
    const { username: usernameParam } = await params;
    const username = String(usernameParam || "").trim();
    const formData = await request.formData();

    const newUsernameRaw = formData.get("new_username");
    const newUsername =
      typeof newUsernameRaw === "string" ? newUsernameRaw.trim() : "";

    let effectiveUsername = username;

    if (newUsername && newUsername !== username) {
      try {
        const { actualNew } = await renameRepListUsername(username, newUsername);
        effectiveUsername = actualNew;
      } catch (renameErr) {
        const msg = renameErr?.message || "Could not rename username.";
        const status = msg.includes("not found") ? 404 : 400;
        return NextResponse.json({ message: msg }, { status });
      }
    }

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
    let queryParams = [email, dob, number, address, state, userRole, effectiveUsername];

    if (profilePic && typeof profilePic !== "string") {
      const bytes = await profilePic.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const userDir = path.join(
        process.cwd(),
        "public",
        "employees",
        effectiveUsername
      );

      await mkdir(userDir, { recursive: true });

      const filename = "profile.jpg";
      const filePath = path.join(userDir, filename);

      await writeFile(filePath, buffer);

      profilePicPath = `/employees/${effectiveUsername}/${filename}`;
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
        effectiveUsername,
      ];
    }

    const db = await getDbConnection();

    const [checkRows] = await db.query(
      "SELECT username FROM rep_list WHERE username = ?",
      [effectiveUsername],
    );
    if (checkRows.length === 0) {
      return NextResponse.json(
        { message: "Employee not found." },
        { status: 404 },
      );
    }

    const [result] = await db.query(query, queryParams);

    return NextResponse.json({
      message:
        result.affectedRows > 0
          ? "Employee updated successfully."
          : "No changes made (data already up to date).",
      username: effectiveUsername,
    });
  } catch (error) {
    console.error("Error updating employee data:", error);
    return NextResponse.json(
      { message: error?.message || "Internal server error." },
      { status: 500 },
    );
  }
}
