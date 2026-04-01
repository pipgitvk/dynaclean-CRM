/**
 * GET /api/cron/salary-generate
 * Monthly cron: auto-generate salary slips for all employees for previous month.
 * Call this daily (e.g. 8am) — it only runs on the configured day_of_month.
 * Auth: ?secret=CRON_SECRET OR Authorization: Bearer CRON_SECRET
 * HR can also trigger manually from the Salary Management page.
 */
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  rowToAttendanceRulesShape,
  mergeGlobalRulesWithEmployeeSchedule,
} from "@/lib/attendanceRulesDb";
import { computeSalaryPayDaysForUser } from "@/lib/salaryPayDaysFromAttendance";
import {
  computeSpecialAllowanceFromGross,
  computeBasicHraFromGrossSalary,
  floorInr,
  getEffectiveGrossSalary,
  applyStatutoryDeductionsFromStructure,
  isHealthInsuranceDeductionRow,
} from "@/lib/salaryGrossSpecialAllowance";

function normalizeUserKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Working days in a month (exclude Sundays). */
function calcWorkingDays(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0) count++; // 0 = Sunday
  }
  return count;
}

/** Previous month as { year, month (1-12), label "YYYY-MM" }. */
function prevMonth() {
  const now = new Date();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  const label = `${y}-${String(m).padStart(2, "0")}`;
  return { year: y, month: m, label };
}

async function generateForEmployee({ db, emp, salaryMonth, workingDays, defaultStatus, salaryContext }) {
  const [structRows] = await db.query(
    `SELECT * FROM employee_salary_structure WHERE username = ? AND is_active = 1 ORDER BY effective_from DESC LIMIT 1`,
    [emp.username]
  );
  if (!structRows.length) return { skipped: true, reason: "no structure" };

  const structure = structRows[0];

  const logs = salaryContext.logsByUser[emp.username] || [];
  const rules = mergeGlobalRulesWithEmployeeSchedule(
    salaryContext.globalRules,
    salaryContext.scheduleByUser.get(normalizeUserKey(emp.username)) || null
  );
  const stats = computeSalaryPayDaysForUser({
    monthStr: salaryMonth,
    logs,
    holidaysAll: salaryContext.holidays,
    leavesAll: salaryContext.leaves,
    username: emp.username,
    rules,
  });
  const presentDays = stats.pay_days;

  const [deductions] = await db.query(
    `SELECT esd.*, sdt.deduction_name, sdt.deduction_code, sdt.calculation_type, sdt.is_mandatory
     FROM employee_salary_deductions esd
     JOIN salary_deduction_types sdt ON esd.deduction_type_id = sdt.id
     WHERE esd.username = ? AND esd.is_active = 1
       AND esd.effective_from <= ? AND (esd.effective_to IS NULL OR esd.effective_to >= ?)`,
    [emp.username, salaryMonth + "-31", salaryMonth + "-01"]
  );

  const structBasic = Number(structure.basic_salary) || 0;
  const structHra = Number(structure.hra) || 0;
  const structTransport = Number(structure.transport_allowance) || 0;
  const structMedical = Number(structure.medical_allowance) || 0;
  const structSpecial = Number(structure.special_allowance) || 0;
  const structBonus = Number(structure.bonus) || 0;
  const structPf = Number(structure.pf) || 0;
  const structEsi = Number(structure.esi) || 0;
  const structHealthInsurance = Number(structure.health_insurance) || 0;
  const structOvertimeRate = Number(structure.overtime_rate) || 0;

  const effectiveGross = getEffectiveGrossSalary(structure);
  const hasGross = effectiveGross != null && effectiveGross > 0;

  let basicSalary, hra;
  if (hasGross) {
    const bh = computeBasicHraFromGrossSalary({ grossSalary: effectiveGross, workingDays, presentDays });
    basicSalary = bh.basicSalary;
    hra = bh.hra;
  } else {
    basicSalary = floorInr((structBasic * presentDays) / workingDays);
    hra = structBasic > 0 ? floorInr((structHra / structBasic) * basicSalary) : 0;
  }

  const transportAllowance = floorInr(structTransport);
  const medicalAllowance = floorInr(structMedical);
  const specialAllowance = computeSpecialAllowanceFromGross({
    grossSalary: hasGross ? effectiveGross : null,
    workingDays,
    presentDays,
    basicSalary,
    hra,
    transportAllowance,
    medicalAllowance,
    fallbackStructureSpecial: structSpecial,
  });
  const bonus = floorInr(structBonus);
  const overtimeAmount = 0;

  const totalEarnings = basicSalary + hra + transportAllowance + medicalAllowance + specialAllowance + bonus;

  const { pf, esi, healthInsurance: healthInsuranceStored, lowGrossPfRule } =
    applyStatutoryDeductionsFromStructure({
      effectiveGross,
      structPf,
      structEsi,
      structHealthInsurance,
      basicSalary,
      totalEarnings,
    });

  let totalDeductions = pf + esi + healthInsuranceStored;
  const deductionDetails = [];

  for (const deduction of deductions) {
    const code = deduction.deduction_code;
    const name = deduction.deduction_name;
    const isPF = code === "PF" || name.includes("Provident Fund");
    const isESI = code === "ESI" || name.includes("ESI");

    if (isPF) {
      deductionDetails.push({ ...deduction, amount: 0 });
      continue;
    }
    if (lowGrossPfRule && isHealthInsuranceDeductionRow(deduction)) {
      deductionDetails.push({ ...deduction, amount: 0 });
      continue;
    }
    if (isESI && structEsi <= 0) {
      deductionDetails.push({ ...deduction, amount: 0 });
      continue;
    }

    let amount = 0;
    if (deduction.calculation_type === "fixed" || (Number(deduction.amount) > 0)) {
      amount = Number(deduction.amount);
    } else if (deduction.calculation_type === "percentage" && deduction.percentage > 0) {
      amount = (deduction.percentage / 100) * totalEarnings;
    }
    if (structEsi > 0 && isESI) amount = 0;

    totalDeductions += amount;
    deductionDetails.push({ ...deduction, amount: Math.round(amount * 100) / 100 });
  }

  const netSalary = totalEarnings - totalDeductions;

  const esiFromTable = deductionDetails.find((d) => d.deduction_code === "ESI")?.amount || 0;
  const esiStored = esi > 0 ? esi : esiFromTable;
  const otherBase = deductionDetails
    .filter((d) => !["PF", "ESI", "IT", "PT"].includes(d.deduction_code))
    .reduce((s, d) => s + d.amount, 0);
  const otherStored = otherBase + healthInsuranceStored;

  const [existing] = await db.query(
    "SELECT id, status FROM monthly_salary_records WHERE username = ? AND salary_month = ?",
    [emp.username, salaryMonth]
  );

  let recordId;
  if (existing.length > 0) {
    // Skip if already approved/paid — don't overwrite
    if (["approved", "paid"].includes(existing[0].status)) {
      return { skipped: true, reason: "already approved/paid" };
    }
    recordId = existing[0].id;
    await db.query(
      `UPDATE monthly_salary_records SET working_days=?, present_days=?, overtime_hours=0,
        basic_salary=?, hra=?, transport_allowance=?, medical_allowance=?, special_allowance=?,
        bonus=?, overtime_amount=0, total_earnings=?, pf_deduction=?, esi_deduction=?,
        income_tax=0, professional_tax=0, other_deductions=?, total_deductions=?,
        gross_salary=?, net_salary=?, status=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?`,
      [
        workingDays, presentDays, basicSalary, hra, transportAllowance, medicalAllowance,
        specialAllowance, bonus, totalEarnings, pf, esiStored, otherStored,
        totalDeductions, totalEarnings, netSalary, defaultStatus, recordId,
      ]
    );
    await db.query("DELETE FROM salary_deduction_details WHERE salary_record_id = ?", [recordId]);
  } else {
    const [result] = await db.query(
      `INSERT INTO monthly_salary_records
        (username, salary_month, working_days, present_days, overtime_hours,
         basic_salary, hra, transport_allowance, medical_allowance, special_allowance,
         bonus, overtime_amount, total_earnings, pf_deduction, esi_deduction,
         income_tax, professional_tax, other_deductions, total_deductions,
         gross_salary, net_salary, status, created_by)
       VALUES (?,?,?,?,0, ?,?,?,?,?, ?,0,?,?,?, 0,0,?,?, ?,?,?,?)`,
      [
        emp.username, salaryMonth, workingDays, presentDays,
        basicSalary, hra, transportAllowance, medicalAllowance, specialAllowance,
        bonus, totalEarnings, pf, esiStored, otherStored,
        totalDeductions, totalEarnings, netSalary, defaultStatus, "AUTO_CRON",
      ]
    );
    recordId = result.insertId;
  }

  for (const d of deductionDetails) {
    await db.query(
      "INSERT INTO salary_deduction_details (salary_record_id, deduction_type_id, deduction_name, amount, reason) VALUES (?,?,?,?,?)",
      [recordId, d.deduction_type_id, d.deduction_name, d.amount, d.reason || null]
    );
  }

  return { success: true, netSalary };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cronSecret = process.env.CRON_SECRET;

    // Allow HR trigger from UI (no secret needed) via POST, or cron with secret
    const isManual = searchParams.get("manual") === "1";
    if (!isManual) {
      if (cronSecret && secret !== cronSecret && bearerToken !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const db = await getDbConnection();

    // Fetch settings
    const [settingRows] = await db.query("SELECT * FROM salary_auto_settings LIMIT 1");
    if (!settingRows.length) {
      return NextResponse.json({ success: false, message: "Auto settings not configured." });
    }

    const settings = settingRows[0];

    if (!isManual) {
      // Only run on configured day of month
      const todayDay = new Date().getDate();
      if (!settings.is_enabled) {
        return NextResponse.json({ success: false, message: "Auto payroll is disabled." });
      }
      if (todayDay !== settings.day_of_month) {
        return NextResponse.json({
          success: false,
          message: `Not the run day. Configured: ${settings.day_of_month}, Today: ${todayDay}`,
        });
      }
    }

    const { year, month, label: salaryMonth } = prevMonth();
    const calWorkingDays = calcWorkingDays(year, month);
    const workingDays = settings.working_days > 0 ? settings.working_days : calWorkingDays;
    const defaultStatus = settings.generate_status || "draft";

    // Check duplicate run for this month
    if (!isManual && settings.last_run_month === salaryMonth) {
      return NextResponse.json({ success: false, message: `Already ran for ${salaryMonth}.` });
    }

    // Fetch all active employees
    const [employees] = await db.query(
      "SELECT username FROM rep_list WHERE status = 1 ORDER BY username"
    );

    const [attendanceRows] = await db.query(
      `SELECT username, date, checkin_time, checkout_time,
        break_morning_start, break_morning_end,
        break_lunch_start, break_lunch_end,
        break_evening_start, break_evening_end
      FROM attendance_logs WHERE date LIKE ?`,
      [`${salaryMonth}%`]
    );
    const logsByUser = {};
    for (const row of attendanceRows) {
      if (!logsByUser[row.username]) logsByUser[row.username] = [];
      logsByUser[row.username].push(row);
    }

    const [holidays] = await db.query(
      `SELECT holiday_date, title, description FROM holidays ORDER BY holiday_date DESC`
    );
    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason
       FROM employee_leaves WHERE status = 'approved'`
    );

    const globalRow = await loadGlobalAttendanceRulesRow(db);
    const globalRules = rowToAttendanceRulesShape(globalRow);
    await ensureEmployeeAttendanceScheduleTable();
    const [schedules] = await db.query(`SELECT * FROM employee_attendance_schedule`);
    const scheduleByUser = new Map(
      (schedules || []).map((s) => [normalizeUserKey(s.username), s])
    );

    const salaryContext = {
      logsByUser,
      holidays,
      leaves,
      globalRules,
      scheduleByUser,
    };

    let generated = 0, skipped = 0, failed = 0;
    const errors = [];

    for (const emp of employees) {
      try {
        const result = await generateForEmployee({
          db,
          emp,
          salaryMonth,
          workingDays,
          defaultStatus,
          salaryContext,
        });
        if (result.success) generated++;
        else skipped++;
      } catch (err) {
        failed++;
        errors.push({ username: emp.username, error: err.message });
        console.error(`salary-generate error for ${emp.username}:`, err);
      }
    }

    // Update last_run
    await db.query(
      "UPDATE salary_auto_settings SET last_run_at = CURRENT_TIMESTAMP, last_run_month = ? WHERE id = ?",
      [salaryMonth, settings.id]
    );

    return NextResponse.json({
      success: true,
      salaryMonth,
      generated,
      skipped,
      failed,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error("salary-generate cron error:", err);
    return NextResponse.json({ error: "Internal error", message: err.message }, { status: 500 });
  }
}
