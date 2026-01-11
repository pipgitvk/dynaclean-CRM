// src/app/api/empcrm/salary/calculate/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// POST - Calculate salary for a specific month
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const { username, salary_month, working_days, present_days, overtime_hours, status } = body;

    const db = await getDbConnection();

    // Verify employee exists
    const [empData] = await db.query(
      "SELECT username FROM rep_list WHERE username = ? and status = 1",
      [username]
    );

    if (empData.length === 0) {
      return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }

    // Get current salary structure
    const [salaryStructure] = await db.query(`
      SELECT * FROM employee_salary_structure 
      WHERE username = ? AND is_active = 1 
      ORDER BY effective_from DESC LIMIT 1
    `, [username]);

    if (salaryStructure.length === 0) {
      return NextResponse.json({ message: "Salary structure not found." }, { status: 404 });
    }

    const structure = salaryStructure[0];

    // Get active deductions
    const [deductions] = await db.query(`
      SELECT esd.*, sdt.deduction_name, sdt.deduction_code, sdt.calculation_type, sdt.is_mandatory
      FROM employee_salary_deductions esd
      JOIN salary_deduction_types sdt ON esd.deduction_type_id = sdt.id
      WHERE esd.username = ? AND esd.is_active = 1
      AND (esd.effective_from <= ? AND (esd.effective_to IS NULL OR esd.effective_to >= ?))
    `, [username, salary_month + '-31', salary_month + '-01']);

    // Calculate daily rate
    const workingDays = Number(working_days);
    const presentDays = Number(present_days);
    const overtimeHours = Number(overtime_hours) || 0;

    // Ensure structure values are numbers
    const structBasic = Number(structure.basic_salary) || 0;
    const structHra = Number(structure.hra) || 0;
    const structTransport = Number(structure.transport_allowance) || 0;
    const structMedical = Number(structure.medical_allowance) || 0;
    const structSpecial = Number(structure.special_allowance) || 0;
    const structBonus = Number(structure.bonus) || 0;
    const structOvertimeRate = Number(structure.overtime_rate) || 0;

    const dailyRate = structBasic / workingDays;

    // Calculate earnings
    const basicSalary = dailyRate * presentDays;
    // HRA logic: (HRA / Basic) * CalculatedBasic. Correct?
    // If Structure Basic is 0, HRA calc will fail.
    const hra = structBasic > 0 ? (structHra / structBasic) * basicSalary : 0;

    const transportAllowance = structTransport;
    const medicalAllowance = structMedical;
    const specialAllowance = structSpecial;
    const bonus = structBonus;
    const overtimeAmount = overtimeHours * structOvertimeRate;

    const totalEarnings = basicSalary + hra + transportAllowance + medicalAllowance +
      specialAllowance + bonus + overtimeAmount;

    // Calculate deductions
    let totalDeductions = 0;
    const deductionDetails = [];

    for (const deduction of deductions) {
      let amount = 0;

      const code = deduction.deduction_code;
      const name = deduction.deduction_name;

      const isPF = code === 'PF' || name === 'PF' || name.includes('Provident Fund');
      const isESI = code === 'ESI' || name === 'ESI' || name.includes('ESI');
      const isIT = code === 'IT' || name === 'IT' || name.includes('Income Tax');
      const isPT = code === 'PT' || name === 'PT' || name.includes('Professional Tax');

      // 1. Priority: Fixed Amount checking
      if (deduction.calculation_type === 'fixed' || (Number(deduction.amount) > 0 && !deduction.percentage && deduction.calculation_type !== 'formula')) {
        amount = Number(deduction.amount);
      }
      // 2. Priority: Percentage
      else if (deduction.calculation_type === 'percentage' && deduction.percentage > 0) {
        amount = (deduction.percentage / 100) * totalEarnings;
      }
      // 3. Priority: Standard Formula / Code-based Fallback
      else {
        if (isPF) {
          amount = 0.12 * basicSalary;
        } else if (isESI) {
          amount = 0.0075 * totalEarnings;
        } else if (isIT) {
          const annualIncome = totalEarnings * 12;
          if (annualIncome > 250000) {
            amount = ((annualIncome - 250000) * 0.1) / 12;
          } else {
            amount = 0;
          }
        } else if (isPT) {
          amount = Number(deduction.amount) > 0 ? Number(deduction.amount) : 200;
        } else {
          // Fallback default
          amount = Number(deduction.amount) || 0;
        }
      }

      totalDeductions += amount;
      deductionDetails.push({
        deduction_type_id: deduction.deduction_type_id,
        deduction_name: deduction.deduction_name,
        deduction_code: deduction.deduction_code,
        amount: Math.round(amount * 100) / 100,
        reason: deduction.reason
      });
    }

    const netSalary = totalEarnings - totalDeductions;

    // Check if salary record already exists
    const [existingRecord] = await db.query(`
      SELECT id FROM monthly_salary_records 
      WHERE username = ? AND salary_month = ?
    `, [username, salary_month]);

    let salaryRecordId;

    if (existingRecord.length > 0) {
      // Update existing record
      salaryRecordId = existingRecord[0].id;

      await db.query(`
        UPDATE monthly_salary_records 
        SET working_days = ?, present_days = ?, overtime_hours = ?,
            basic_salary = ?, hra = ?, transport_allowance = ?, medical_allowance = ?,
            special_allowance = ?, bonus = ?, overtime_amount = ?, total_earnings = ?,
            pf_deduction = ?, esi_deduction = ?, income_tax = ?, professional_tax = ?,
            other_deductions = ?, total_deductions = ?, gross_salary = ?, net_salary = ?,
            status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        working_days, present_days, overtime_hours,
        basicSalary, hra, transportAllowance, medicalAllowance,
        specialAllowance, bonus, overtimeAmount, totalEarnings,
        deductionDetails.find(d => d.deduction_code === 'PF')?.amount || 0,
        deductionDetails.find(d => d.deduction_code === 'ESI')?.amount || 0,
        deductionDetails.find(d => d.deduction_code === 'IT')?.amount || 0,
        deductionDetails.find(d => d.deduction_code === 'PT')?.amount || 0,
        deductionDetails.filter(d =>
          d.deduction_code !== 'PF' &&
          d.deduction_code !== 'ESI' &&
          d.deduction_code !== 'IT' &&
          d.deduction_code !== 'PT'
        ).reduce((sum, d) => sum + d.amount, 0),
        totalDeductions, totalEarnings, netSalary, status || 'draft', salaryRecordId
      ]);

      // Delete existing deduction details
      await db.query("DELETE FROM salary_deduction_details WHERE salary_record_id = ?", [salaryRecordId]);
    } else {
      // Insert new record
      const [result] = await db.query(`
        INSERT INTO monthly_salary_records 
        (username, salary_month, working_days, present_days, overtime_hours,
         basic_salary, hra, transport_allowance, medical_allowance, special_allowance, 
         bonus, overtime_amount, total_earnings, pf_deduction, esi_deduction, 
         income_tax, professional_tax, other_deductions, total_deductions, 
         gross_salary, net_salary, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        username, salary_month, working_days, present_days, overtime_hours,
        basicSalary, hra, transportAllowance, medicalAllowance, specialAllowance,
        bonus, overtimeAmount, totalEarnings,
        deductionDetails.find(d => d.deduction_code === 'PF')?.amount || 0,
        deductionDetails.find(d => d.deduction_code === 'ESI')?.amount || 0,
        deductionDetails.find(d => d.deduction_code === 'IT')?.amount || 0,
        deductionDetails.find(d => d.deduction_code === 'PT')?.amount || 0,
        deductionDetails.filter(d =>
          d.deduction_code !== 'PF' &&
          d.deduction_code !== 'ESI' &&
          d.deduction_code !== 'IT' &&
          d.deduction_code !== 'PT'
        ).reduce((sum, d) => sum + d.amount, 0),
        totalDeductions, totalEarnings, netSalary, status || 'draft', payload.username
      ]);

      salaryRecordId = result.insertId;
    }

    // Insert deduction details
    for (const detail of deductionDetails) {
      await db.query(`
        INSERT INTO salary_deduction_details 
        (salary_record_id, deduction_type_id, deduction_name, amount, reason)
        VALUES (?, ?, ?, ?, ?)
      `, [salaryRecordId, detail.deduction_type_id, detail.deduction_name, detail.amount, detail.reason]);
    }

    return NextResponse.json({
      success: true,
      message: "Salary calculated successfully.",
      salaryData: {
        basicSalary: Math.round(basicSalary * 100) / 100,
        hra: Math.round(hra * 100) / 100,
        transportAllowance: Math.round(transportAllowance * 100) / 100,
        medicalAllowance: Math.round(medicalAllowance * 100) / 100,
        specialAllowance: Math.round(specialAllowance * 100) / 100,
        bonus: Math.round(bonus * 100) / 100,
        overtimeAmount: Math.round(overtimeAmount * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        deductionDetails
      }
    });

  } catch (error) {
    console.error("Error calculating salary:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}
