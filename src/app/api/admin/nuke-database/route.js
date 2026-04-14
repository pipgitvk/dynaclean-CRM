export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

// Tables to truncate (all main business data + all employees)
const TABLES_TO_TRUNCATE = [
  // Orders & billing
  "dispatch",
  "invoice_items",
  "invoices",
  "neworder",
  "quotation_items",
  "quotations_records",
  // Customers & leads
  "customers_followup",
  "customers",
  "demoregistration",
  // Service & installation
  "service_reports",
  "installation_reports",
  "order_return_items",
  // Tasks & expenses
  "task_followup",
  "task",
  "expenses",
  "assets",
  // Production & stock
  "production",
  "stock_list",
  "stock_summary",
  "spare_stock_request",
  "spare_list",
  // Employees & HR
  "rep_list",
  "emplist",
  "attendance_logs",
  "employee_leaves",
  "monthly_salary_records",
  "salary_deduction_details",
  "employee_salary_deductions",
  "salary_deduction_types",
  // Activity logs
  "login_activity",
];

export async function DELETE(request) {
  try {
    const actor = await getMainSessionPayload();
    if (!actor || actor.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { confirmText } = await request.json();
    if (confirmText !== "DELETE ALL") {
      return NextResponse.json(
        { error: "Invalid confirmation text" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();

    // Get all existing tables in the DB
    const [existingTables] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
    );
    const existingTableNames = new Set(
      existingTables.map((r) => r.TABLE_NAME),
    );

    // Disable FK checks to allow truncating in any order
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    const results = [];
    for (const table of TABLES_TO_TRUNCATE) {
      if (!existingTableNames.has(table)) {
        results.push({ table, status: "skipped (not found)" });
        continue;
      }
      try {
        await conn.query(`TRUNCATE TABLE \`${table}\``);
        results.push({ table, status: "truncated" });
      } catch (err) {
        results.push({ table, status: `error: ${err.message}` });
      }
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    // --- Delete all uploaded files ---
    const uploadDirs = [
      path.join(process.cwd(), "public", "uploads"),
      path.join(process.cwd(), "uploads"),
    ];

    const fileResults = [];
    for (const dir of uploadDirs) {
      try {
        await fs.access(dir);
        // Delete all contents inside the folder but keep the folder itself
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          try {
            await fs.rm(entryPath, { recursive: true, force: true });
            fileResults.push({ path: entryPath, status: "deleted" });
          } catch (err) {
            fileResults.push({ path: entryPath, status: `error: ${err.message}` });
          }
        }
      } catch {
        fileResults.push({ path: dir, status: "skipped (not found)" });
      }
    }

    return NextResponse.json({ success: true, results, fileResults });
  } catch (error) {
    console.error("Nuke database error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
