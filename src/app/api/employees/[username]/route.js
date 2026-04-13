// app/api/employees/[username]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getMainSessionPayload } from "@/lib/auth";
import {
  parseModuleAccess,
  ALL_MODULE_KEYS,
  applySuperadminOnlyModuleRestrictions,
} from "@/lib/moduleAccess";
// Login username rename disabled — keep import commented if re-enabled:
// import { renameRepListUsername } from "@/lib/renameRepListUsername";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

/** Ensure module_access column exists — runs once, cached after first success */
let _columnEnsured = false;
async function ensureModuleAccessColumn(db) {
  if (_columnEnsured) return;
  try {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'rep_list'
         AND COLUMN_NAME = 'module_access'`
    );
    if (cols.length === 0) {
      await db.query(
        `ALTER TABLE rep_list ADD COLUMN module_access TEXT NULL DEFAULT NULL`
      );
      console.log("[DB] Added module_access column to rep_list");
    }
    _columnEnsured = true;
  } catch (e) {
    console.error("[DB] ensureModuleAccessColumn error:", e.message);
  }
}

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
    await ensureModuleAccessColumn(db);

    const [rows] = await db.query(
      "SELECT username, email, dob, number, address, state, userRole, profile_pic, status, module_access FROM rep_list WHERE username = ?",
      [username],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Employee not found." },
        { status: 404 },
      );
    }

    const mainPayload = await getMainSessionPayload();
    const canEditEmployeeStatus = mainPayload?.role === "SUPERADMIN";
    const canEditModuleAccess = mainPayload?.role === "SUPERADMIN";

    const emp = rows[0];
    // Backward compat: NULL module_access → all modules granted
    const moduleAccessRaw = parseModuleAccess(emp.module_access ?? null);
    const moduleAccess = applySuperadminOnlyModuleRestrictions(
      moduleAccessRaw,
      emp.userRole,
    );

    return NextResponse.json({
      employee: { ...emp, module_access: moduleAccess },
      canEditEmployeeStatus,
      canEditModuleAccess,
      allModuleKeys: ALL_MODULE_KEYS,
    });
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
    const effectiveUsername = username;

    const db = await getDbConnection();
    await ensureModuleAccessColumn(db);

    const email = formData.get("email");
    const dob = formData.get("dob");
    const number = formData.get("number");
    const address = formData.get("address");
    const state = formData.get("state");
    const userRole = formData.get("userRole");
    const profilePic = formData.get("profile_pic");
    const statusRaw = formData.get("status");
    const moduleAccessRaw = formData.get("module_access"); // JSON string from frontend

    const mainPayload = await getMainSessionPayload();
    let statusToSet = null;
    if (statusRaw !== null && statusRaw !== "") {
      const s = Number(statusRaw);
      if (s !== 0 && s !== 1) {
        return NextResponse.json(
          { message: "status must be 0 or 1." },
          { status: 400 },
        );
      }
      if (mainPayload?.role !== "SUPERADMIN") {
        return NextResponse.json(
          { message: "Forbidden: only SUPERADMIN can change employee status." },
          { status: 403 },
        );
      }
      const actor = String(mainPayload.username || "").toLowerCase();
      if (s === 0 && actor === String(effectiveUsername).toLowerCase()) {
        return NextResponse.json(
          { message: "You cannot deactivate your own account." },
          { status: 400 },
        );
      }
      statusToSet = s;
    }

    // Validate + resolve module_access (only SUPERADMIN can set it)
    let moduleAccessToSet = null;
    if (moduleAccessRaw !== null && moduleAccessRaw !== "" && mainPayload?.role === "SUPERADMIN") {
      try {
        const parsed = JSON.parse(moduleAccessRaw);
        if (Array.isArray(parsed)) {
          const effective = applySuperadminOnlyModuleRestrictions(parsed, userRole);
          moduleAccessToSet = JSON.stringify(effective ?? []);
        }
      } catch {
        // ignore malformed input
      }
    }

    let profilePicPath = formData.get("current_profile_pic");

    // Build dynamic SET clause
    const setClauses = ["email = ?", "dob = ?", "number = ?", "address = ?", "state = ?", "userRole = ?"];
    let queryParams = [email, dob, number, address, state, userRole];

    if (statusToSet !== null) {
      setClauses.push("status = ?");
      queryParams.push(statusToSet);
    }

    // module_access column might not exist yet; try/catch handled after profilePic logic
    const includeModuleAccess = moduleAccessToSet !== null;
    if (includeModuleAccess) {
      setClauses.push("module_access = ?");
      queryParams.push(moduleAccessToSet);
    }

    // placeholder — will be replaced below after profile pic handling
    let query = `UPDATE rep_list SET ${setClauses.join(", ")} WHERE username = ?`;

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

      // Rebuild SET clauses with profile_pic included at correct position (after userRole)
      const setClausesWithPic = [
        "email = ?", "dob = ?", "number = ?", "address = ?", "state = ?", "userRole = ?",
        "profile_pic = ?",
      ];
      const queryParamsWithPic = [email, dob, number, address, state, userRole, profilePicPath];

      if (statusToSet !== null) {
        setClausesWithPic.push("status = ?");
        queryParamsWithPic.push(statusToSet);
      }
      if (includeModuleAccess) {
        setClausesWithPic.push("module_access = ?");
        queryParamsWithPic.push(moduleAccessToSet);
      }

      query = `UPDATE rep_list SET ${setClausesWithPic.join(", ")} WHERE username = ?`;
      queryParams = queryParamsWithPic;
    }

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

    // Append the WHERE param and execute
    const finalParams = [...queryParams, effectiveUsername];
    const [result] = await db.query(query, finalParams);

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
