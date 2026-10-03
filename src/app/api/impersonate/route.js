// app/api/impersonate/route.js
import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { getDbConnection } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";
const secret = new TextEncoder().encode(JWT_SECRET);

export async function POST(request) {
  try {
    const { empId } = await request.json();
    console.log("employee id ", empId);
    const cookieStore = await cookies();
    const adminToken = cookieStore.get("token")?.value;

    if (!adminToken) {
      return NextResponse.json(
        { error: "Admin not authenticated" },
        { status: 401 },
      );
    }

    // Verify the admin's token
    const { payload: adminPayload } = await jwtVerify(adminToken, secret);

    if (adminPayload.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 },
      );
    }

    const conn = await getDbConnection();
    const [empRows] = await conn.execute(
      "SELECT username, userRole FROM rep_list WHERE empId = ?",
      [empId],
    );
    // await conn.end();

    if (empRows.length === 0) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const employee = empRows[0];

    // Generate a new, temporary token for the employee
    const impersonationToken = await new SignJWT({
      id: employee.id, // Assuming 'id' exists
      username: employee.username,
      role: employee.userRole,
      impersonated: true,
      impersonatedBy: adminPayload.username,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h") // Set a short expiration time
      .sign(secret);

    return NextResponse.json({ token: impersonationToken });
  } catch (error) {
    console.error("Error during impersonation:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
