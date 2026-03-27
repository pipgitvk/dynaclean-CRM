import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const HR_SALARY_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/**
 * GET — all employees' monthly salary rows (payslip list). HR roles only.
 * Query: month=YYYY-MM, search=username/empId fragment, limit, offset
 */
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !HR_SALARY_ROLES.includes(payload.role)) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const search = (searchParams.get("search") || "").trim();
    let limit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    let offset = parseInt(searchParams.get("offset") || "0", 10);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const db = await getDbConnection();

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
      WHERE 1=1
    `;
    const params = [];

    if (month) {
      query += " AND esr.salary_month = ?";
      params.push(month);
    }
    if (search) {
      const like = `%${search}%`;
      query += " AND (esr.username LIKE ? OR rl.empId LIKE ? OR rl.email LIKE ?)";
      params.push(like, like, like);
    }

    query += " ORDER BY esr.salary_month DESC, esr.username ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [salaryRecords] = await db.query(query, params);

    if (salaryRecords.length > 0) {
      const recordIds = salaryRecords.map((r) => r.id);
      const placeholders = recordIds.map(() => "?").join(",");
      const [deductionDetails] = await db.query(
        `SELECT * FROM salary_deduction_details WHERE salary_record_id IN (${placeholders})`,
        recordIds
      );
      salaryRecords.forEach((record) => {
        record.deduction_details = deductionDetails.filter(
          (d) => d.salary_record_id === record.id
        );
      });
    }

    return NextResponse.json({
      success: true,
      salaryRecords,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching all salary records:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}
