// src/app/api/empcrm/salary/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
const HR_SALARY_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

/** Employees only see payslip rows after approval (paid counts as post-approval). */
const USER_VISIBLE_SLIP_STATUSES = ["approved", "paid"];

// GET - Fetch salary information for user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const month = searchParams.get("month");
    const historyAll = searchParams.get("history") === "all";

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const db = await getDbConnection();

    // If username is provided, fetch for specific user (admin access)
    const targetUsername = username || payload.username;

    if (username && username !== payload.username) {
      if (!HR_SALARY_ROLES.includes(payload.role)) {
        return NextResponse.json({ message: "Unauthorized access." }, { status: 403 });
      }
    }


    let query = `
      SELECT 
        esr.*,
        rl.username as full_name,
        rl.email,
        rl.userDepartment,
        rl.userRole,
        rl.empId,
        ep.bank_name,
        ep.bank_account_number,
        ep.pf_uan,
        ep.esic_number,
        ep.pan_number,
        ep.department,
        ep.date_of_joining,
        rl.gender
      FROM monthly_salary_records esr
      JOIN rep_list rl ON esr.username = rl.username
      LEFT JOIN employee_profiles ep ON rl.username = ep.username
      WHERE esr.username = ?
    `;

    let params = [targetUsername];

    if (month) {
      query += " AND esr.salary_month = ?";
      params.push(month);
    }

    const viewingOwnSalary =
      !username || username === payload.username;
    if (viewingOwnSalary) {
      query += ` AND LOWER(TRIM(esr.status)) IN (${USER_VISIBLE_SLIP_STATUSES.map(() => "?").join(",")})`;
      params.push(...USER_VISIBLE_SLIP_STATUSES);
    }

    query += " ORDER BY esr.salary_month DESC";
    if (!historyAll) {
      query += " LIMIT 12";
    }

    const [salaryRecords] = await db.query(query, params);

    // Fetch deduction details for these records
    if (salaryRecords.length > 0) {
      const recordIds = salaryRecords.map((r) => r.id);
      const placeholders = recordIds.map(() => "?").join(",");
      const [deductionDetails] = await db.query(
        `SELECT * FROM salary_deduction_details WHERE salary_record_id IN (${placeholders})`,
        recordIds
      );

      // Attach details to records
      salaryRecords.forEach((record) => {
        record.deduction_details = deductionDetails.filter(
          (d) => d.salary_record_id === record.id
        );
      });
    }

    // Fetch current salary structure
    const [salaryStructure] = await db.query(`
      SELECT * FROM employee_salary_structure 
      WHERE username = ? AND is_active = 1 
      ORDER BY effective_from DESC LIMIT 1
    `, [targetUsername]);

    // Fetch active deductions
    const [deductions] = await db.query(`
      SELECT esd.*, sdt.deduction_name, sdt.deduction_code, sdt.calculation_type
      FROM employee_salary_deductions esd
      JOIN salary_deduction_types sdt ON esd.deduction_type_id = sdt.id
      WHERE esd.username = ? AND esd.is_active = 1
      ORDER BY esd.effective_from DESC
    `, [targetUsername]);

    return NextResponse.json({
      success: true,
      salaryRecords,
      salaryStructure: salaryStructure[0] || null,
      deductions
    });

  } catch (error) {
    console.error("Error fetching salary data:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

// POST - Create or update salary structure
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const {
      username,
      basic_salary,
      hra,
      transport_allowance,
      medical_allowance,
      special_allowance,
      bonus,
      gross_salary,
      pf,
      esi,
      health_insurance,
      overtime_rate,
      effective_from
    } = body;

    const db = await getDbConnection();

    // Verify employee exists
    const [empData] = await db.query(
      "SELECT username FROM rep_list WHERE username = ?",
      [username]
    );

    if (empData.length === 0) {
      return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }

    const grossSalaryVal =
      gross_salary === "" || gross_salary === undefined || gross_salary === null
        ? null
        : Number(gross_salary);

    // Deactivate previous salary structure
    await db.query(
      "UPDATE employee_salary_structure SET is_active = 0, effective_to = ? WHERE username = ? AND is_active = 1",
      [new Date(effective_from).toISOString().split('T')[0], username]
    );

    // Insert new salary structure
    const pfVal = pf === "" || pf === undefined || pf === null ? 0 : Number(pf);
    const esiVal = esi === "" || esi === undefined || esi === null ? 0 : Number(esi);
    const healthInsuranceVal =
      health_insurance === "" || health_insurance === undefined || health_insurance === null
        ? 0
        : Number(health_insurance);

    await db.query(`
      INSERT INTO employee_salary_structure 
      (username, basic_salary, hra, transport_allowance, medical_allowance, 
       special_allowance, bonus, gross_salary, pf, esi, health_insurance, overtime_rate, effective_from, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      username, basic_salary, hra, transport_allowance,
      medical_allowance, special_allowance, bonus, grossSalaryVal, pfVal, esiVal, healthInsuranceVal, overtime_rate,
      effective_from, payload.username
    ]);

    return NextResponse.json({ success: true, message: "Salary structure updated successfully." });

  } catch (error) {
    console.error("Error updating salary structure:", error);
    const errno = error?.errno;
    const sqlMessage = error?.sqlMessage || error?.message;
    if (errno === 1054 || error?.code === "ER_BAD_FIELD_ERROR") {
      return NextResponse.json(
        {
          message:
            "Database table is missing expected columns (e.g. pf, esi, health_insurance, gross_salary). Run migrations or: npm run migrate:salary-structure",
          detail: process.env.NODE_ENV === "development" ? sqlMessage : undefined,
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        message: "Internal server error.",
        detail: process.env.NODE_ENV === "development" ? sqlMessage : undefined,
      },
      { status: 500 }
    );
  }
}
