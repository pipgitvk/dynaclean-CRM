// src/app/api/empcrm/salary/deductions/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch deduction types and employee deductions
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const db = await getDbConnection();
    
    // Fetch all deduction types
    const [deductionTypes] = await db.query(`
      SELECT * FROM salary_deduction_types 
      WHERE is_active = 1 
      ORDER BY is_mandatory DESC, deduction_name ASC
    `);
    
    // Fetch employee deductions if username provided
    let employeeDeductions = [];
    if (username) {
      const [deductions] = await db.query(`
        SELECT esd.*, sdt.deduction_name, sdt.deduction_code, sdt.calculation_type, sdt.is_mandatory
        FROM employee_salary_deductions esd
        JOIN salary_deduction_types sdt ON esd.deduction_type_id = sdt.id
        WHERE esd.username = ? AND esd.is_active = 1
        ORDER BY esd.effective_from DESC
      `, [username]);
      employeeDeductions = deductions;
    }
    
    return NextResponse.json({
      success: true,
      deductionTypes,
      employeeDeductions
    });
    
  } catch (error) {
    console.error("Error fetching deduction data:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

// POST - Add or update employee deduction
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const { 
      username, 
      deduction_type_id, 
      amount, 
      percentage, 
      effective_from, 
      effective_to, 
      reason 
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
    
    // Check if deduction already exists for this period
    const [existingDeduction] = await db.query(`
      SELECT id FROM employee_salary_deductions 
      WHERE username = ? AND deduction_type_id = ? AND is_active = 1
      AND (effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?))
    `, [username, deduction_type_id, effective_from, effective_from]);
    
    if (existingDeduction.length > 0) {
      return NextResponse.json({ 
        message: "Deduction already exists for this period." 
      }, { status: 400 });
    }
    
    // Insert new deduction
    await db.query(`
      INSERT INTO employee_salary_deductions 
      (username, deduction_type_id, amount, percentage, effective_from, effective_to, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      username, deduction_type_id, amount, percentage, 
      effective_from, effective_to, reason, payload.username
    ]);
    
    return NextResponse.json({ success: true, message: "Deduction added successfully." });
    
  } catch (error) {
    console.error("Error adding deduction:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

// PUT - Update existing deduction
export async function PUT(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json();
    const { 
      deduction_id, 
      amount, 
      percentage, 
      effective_from, 
      effective_to, 
      reason 
    } = body;

    const db = await getDbConnection();
    
    // Update deduction
    await db.query(`
      UPDATE employee_salary_deductions 
      SET amount = ?, percentage = ?, effective_from = ?, effective_to = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [amount, percentage, effective_from, effective_to, reason, deduction_id]);
    
    return NextResponse.json({ success: true, message: "Deduction updated successfully." });
    
  } catch (error) {
    console.error("Error updating deduction:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate deduction
export async function DELETE(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deduction_id = searchParams.get("id");

    const db = await getDbConnection();
    
    // Deactivate deduction
    await db.query(`
      UPDATE employee_salary_deductions 
      SET is_active = 0, effective_to = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [deduction_id]);
    
    return NextResponse.json({ success: true, message: "Deduction deactivated successfully." });
    
  } catch (error) {
    console.error("Error deactivating deduction:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}
