import {
  computeSpecialAllowanceFromGross,
  computeBasicHraFromGrossSalary,
  floorInr,
  proRataMonthlyStructuralLine,
  getEffectiveGrossSalary,
  applyStatutoryDeductionsFromStructure,
  isHealthInsuranceDeductionRow,
} from "@/lib/salaryGrossSpecialAllowance";

const WORKING_DAYS_DEFAULT = 30;

/**
 * Payroll earnings/deductions for one employee (matches salary generate page).
 */
export function computePayrollBreakdown({
  salaryStructure,
  deductions = [],
  presentDays = 0,
  overtimeHours = 0,
  workingDays = WORKING_DAYS_DEFAULT,
}) {
  if (!salaryStructure) {
    return null;
  }

  const present = Number(presentDays) || 0;
  const overtimeH = Number(overtimeHours) || 0;
  const working = Math.max(1, Number(workingDays) || WORKING_DAYS_DEFAULT);

  const structBasic = Number(salaryStructure.basic_salary) || 0;
  const structHra = Number(salaryStructure.hra) || 0;
  const structTransport = Number(salaryStructure.transport_allowance) || 0;
  const structMedical = Number(salaryStructure.medical_allowance) || 0;
  const structSpecial = Number(salaryStructure.special_allowance) || 0;
  const structBonus = Number(salaryStructure.bonus) || 0;
  const structPf = Number(salaryStructure.pf) || 0;
  const structEsi = Number(salaryStructure.esi) || 0;
  const structHealthInsurance = Number(salaryStructure.health_insurance) || 0;
  const structOvertimeRate = Number(salaryStructure.overtime_rate) || 0;

  const effectiveGross = getEffectiveGrossSalary(salaryStructure);
  const hasGross = effectiveGross != null && effectiveGross > 0;

  if (present <= 0) {
    const processedDeductionsZero = (deductions || []).map((deduction) => ({
      ...deduction,
      calculatedAmount: 0,
    }));
    return {
      basicSalary: 0,
      hra: 0,
      transportAllowance: 0,
      medicalAllowance: 0,
      specialAllowance: 0,
      bonus: 0,
      overtimeAmount: 0,
      totalEarnings: 0,
      pf: 0,
      esi: 0,
      healthInsurance: 0,
      advanceDeduction: 0,
      otherDeductions: 0,
      totalDeductions: 0,
      netSalary: 0,
      processedDeductions: processedDeductionsZero,
    };
  }

  let basicSalary;
  let hra;
  if (hasGross) {
    const bh = computeBasicHraFromGrossSalary({
      grossSalary: effectiveGross,
      workingDays: working,
      presentDays: present,
    });
    basicSalary = bh.basicSalary;
    hra = bh.hra;
  } else {
    basicSalary = floorInr((structBasic * present) / working);
    hra =
      structBasic > 0 ? floorInr((structHra / structBasic) * basicSalary) : 0;
  }

  const transportAllowance = hasGross
    ? proRataMonthlyStructuralLine(structTransport, working, present)
    : floorInr(structTransport);
  const medicalAllowance = hasGross
    ? proRataMonthlyStructuralLine(structMedical, working, present)
    : floorInr(structMedical);
  const specialAllowance = computeSpecialAllowanceFromGross({
    grossSalary: hasGross ? effectiveGross : null,
    workingDays: working,
    presentDays: present,
    basicSalary,
    hra,
    transportAllowance,
    medicalAllowance,
    fallbackStructureSpecial: structSpecial,
  });
  const bonus = floorInr(structBonus);
  const overtimeAmount = floorInr(overtimeH * structOvertimeRate);

  const totalEarnings =
    basicSalary +
    hra +
    transportAllowance +
    medicalAllowance +
    specialAllowance +
    bonus +
    overtimeAmount;

  const { pf, esi, healthInsurance } = applyStatutoryDeductionsFromStructure({
    effectiveGross,
    structPf,
    structEsi,
    structHealthInsurance,
    basicSalary,
    totalEarnings,
  });

  let advanceDeduction = 0;
  let otherDeductions = healthInsurance;
  let totalDeductions = pf + esi + healthInsurance;

  const processedDeductions = (deductions || []).map((deduction) => {
    let amount = 0;
    const code = deduction.deduction_code;
    const name = deduction.deduction_name;

    const isPF =
      code === "PF" || name === "PF" || String(name || "").includes("Provident Fund");
    const isESI =
      code === "ESI" || name === "ESI" || String(name || "").includes("ESI");
    const isIT =
      code === "IT" || name === "IT" || String(name || "").includes("Income Tax");
    const isPT =
      code === "PT" || name === "PT" || String(name || "").includes("Professional Tax");
    const isUnpaidLeave =
      code === "UNPAID_LEAVE" ||
      String(name || "").toLowerCase().includes("unpaid leave");
    const isAdvance =
      String(code || "").toUpperCase().includes("ADVANCE") ||
      String(name || "").toLowerCase().includes("advance");

    if (isUnpaidLeave || isPF) {
      return { ...deduction, calculatedAmount: 0 };
    }

    if (isHealthInsuranceDeductionRow(deduction)) {
      return { ...deduction, calculatedAmount: 0 };
    }

    if (isESI && structEsi <= 0) {
      return { ...deduction, calculatedAmount: 0 };
    }

    if (
      deduction.calculation_type === "fixed" ||
      (Number(deduction.amount) > 0 &&
        !deduction.percentage &&
        deduction.calculation_type !== "formula")
    ) {
      amount = Number(deduction.amount);
    } else if (
      deduction.calculation_type === "percentage" &&
      Number(deduction.percentage) > 0
    ) {
      amount = (Number(deduction.percentage) / 100) * totalEarnings;
    } else {
      if (isESI) {
        amount = 0.0075 * totalEarnings;
      } else if (isIT) {
        const annualIncome = totalEarnings * 12;
        amount = annualIncome > 250000 ? ((annualIncome - 250000) * 0.1) / 12 : 0;
      } else if (isPT) {
        amount = 200;
      } else {
        amount = Number(deduction.amount) || 0;
      }
    }

    if (structEsi > 0 && isESI) amount = 0;

    if (!isUnpaidLeave) {
      totalDeductions += amount;
      if (isAdvance) {
        advanceDeduction += amount;
      } else if (!isESI && !isIT && !isPT) {
        otherDeductions += amount;
      } else {
        otherDeductions += amount;
      }
    }
    return { ...deduction, calculatedAmount: amount };
  });

  return {
    basicSalary,
    hra,
    transportAllowance,
    medicalAllowance,
    specialAllowance,
    otherAllowanceEarned:
      transportAllowance + medicalAllowance + specialAllowance + bonus,
    bonus,
    overtimeAmount,
    totalEarnings,
    pf,
    esi,
    healthInsurance,
    advanceDeduction,
    otherDeductions,
    totalDeductions,
    netSalary: totalEarnings - totalDeductions,
    processedDeductions,
  };
}

/** Monthly rate columns (not pro-rated). */
export function getSalaryRateFromStructure(structure) {
  if (!structure) {
    return {
      basic: 0,
      hra: 0,
      otherAllow: 0,
      total: 0,
    };
  }
  const basic = Number(structure.basic_salary) || 0;
  const hra = Number(structure.hra) || 0;
  const otherAllow =
    (Number(structure.transport_allowance) || 0) +
    (Number(structure.medical_allowance) || 0) +
    (Number(structure.special_allowance) || 0) +
    (Number(structure.bonus) || 0);
  const gross = getEffectiveGrossSalary(structure);
  const total =
    gross != null && gross > 0 ? gross : basic + hra + otherAllow;
  return { basic, hra, otherAllow, total };
}

function monthBounds(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return null;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end, y, m };
}

/** Approved half-day leave instances in a month (ledger only, not punch-based HD). */
export function countHalfDayLeaveDaysInMonth(leaves, username, monthStr) {
  const bounds = monthBounds(monthStr);
  if (!bounds) return 0;
  const userKey = String(username ?? "").trim().toLowerCase();
  let total = 0;

  for (const leave of leaves || []) {
    if (String(leave.username ?? "").trim().toLowerCase() !== userKey) continue;
    const st = String(leave.status ?? "approved").toLowerCase();
    if (st !== "approved") continue;

    const type = String(leave.leave_type ?? "").toLowerCase();
    const isHalfLeave = leave.is_half_day == 1 || type === "half-day";
    if (!isHalfLeave) continue;

    const from = new Date(leave.from_date);
    const to = new Date(leave.to_date);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d < bounds.start || d > bounds.end) continue;
      total += 1;
    }
  }
  return total;
}

/** Approved leave days of a given type overlapping a payroll month. */
export function countLeaveTypeDaysInMonth(leaves, username, monthStr, leaveType) {
  const bounds = monthBounds(monthStr);
  if (!bounds) return 0;
  const userKey = String(username ?? "").trim().toLowerCase();
  let total = 0;

  for (const leave of leaves || []) {
    if (String(leave.username ?? "").trim().toLowerCase() !== userKey) continue;
    const st = String(leave.status ?? "approved").toLowerCase();
    if (st !== "approved") continue;
    if (String(leave.leave_type ?? "").toLowerCase() !== String(leaveType).toLowerCase()) {
      continue;
    }
    const from = new Date(leave.from_date);
    const to = new Date(leave.to_date);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d < bounds.start || d > bounds.end) continue;
      total += leave.is_half_day ? 0.5 : 1;
    }
  }
  return total;
}
