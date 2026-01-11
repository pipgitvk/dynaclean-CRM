import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request) {
    try {
        const payload = await getSessionPayload();
        if (!payload || !['SUPERADMIN', 'HR HEAD', 'HR', 'HR Executive'].includes(payload.role)) {
            return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const month = searchParams.get("month"); // Format: YYYY-MM

        if (!month) {
            return NextResponse.json({ message: "Month is required." }, { status: 400 });
        }

        const db = await getDbConnection();

        // Fetch all active employees
        const [employees] = await db.query(`
      SELECT username, username as full_name, userRole, userDepartment 
      FROM rep_list 
      WHERE status = 1
    `);

        // Fetch attendance summary for the month
        // We need specific dates to check for Sundays
        const [attendance] = await db.query(`
      SELECT username, date 
      FROM attendance_logs 
      WHERE date LIKE ? 
    `, [`${month}%`]);

        // Create a map for quick attendance lookup
        const attendanceMap = {};
        attendance.forEach(record => {
            if (!attendanceMap[record.username]) {
                attendanceMap[record.username] = { count: 0, dates: [] };
            }
            attendanceMap[record.username].count++;
            attendanceMap[record.username].dates.push(record.date);
        });

        // Calculate default working days (excluding Sundays, for example)
        // For now, let's assume standard 26/30 or just return raw attendance
        // Ideally, frontend or admin sets the standard "Total Working Days" for the month

        const employeeSummary = employees.map(emp => ({
            username: emp.username,
            full_name: emp.full_name,
            present_days: attendanceMap[emp.username]?.count || 0,
            dates_worked: attendanceMap[emp.username]?.dates || [],
        }));

        return NextResponse.json({
            success: true,
            employees: employeeSummary
        });

    } catch (error) {
        console.error("Error fetching attendance summary:", error);
        return NextResponse.json(
            { message: "Internal server error." },
            { status: 500 }
        );
    }
}
