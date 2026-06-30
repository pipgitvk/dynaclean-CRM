import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Debug endpoint to check and optionally fix quotations_records schema issues.
 * GET: Check current schema
 * POST: Attempt to fix s_no PRIMARY KEY issue
 * 
 * WARNING: This is a debugging/admin endpoint. Should be protected in production.
 */

export async function GET(req) {
  try {
    const conn = await getDbConnection();

    // Check if quotations_records table exists
    const [tables] = await conn.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records'`
    );

    if (tables.length === 0) {
      return NextResponse.json({
        status: "error",
        message: "quotations_records table does not exist"
      }, { status: 404 });
    }

    // Get column information
    const [columns] = await conn.execute(
      `SELECT COLUMN_NAME, COLUMN_KEY, EXTRA, IS_NULLABLE, DATA_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records'`
    );

    // Get constraint information
    const [constraints] = await conn.execute(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records'`
    );

    // Get row count
    const [rowCount] = await conn.execute(
      `SELECT COUNT(*) as count FROM quotations_records`
    );

    // Check for duplicates or issues
    const [sNoDuplicates] = await conn.execute(
      `SELECT s_no, COUNT(*) as count FROM quotations_records WHERE s_no IS NOT NULL GROUP BY s_no HAVING count > 1`
    );

    const [quoteNumberDuplicates] = await conn.execute(
      `SELECT quote_number, COUNT(*) as count FROM quotations_records WHERE quote_number IS NOT NULL GROUP BY quote_number HAVING count > 1`
    );

    return NextResponse.json({
      status: "success",
      table: "quotations_records",
      rowCount: rowCount[0].count,
      columns: columns.map(col => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        key: col.COLUMN_KEY || "NONE",
        extra: col.EXTRA,
        nullable: col.IS_NULLABLE === "YES"
      })),
      constraints: constraints.map(c => ({
        name: c.CONSTRAINT_NAME,
        column: c.COLUMN_NAME
      })),
      issues: {
        sNoDuplicates: sNoDuplicates.length > 0 ? sNoDuplicates : "none",
        quoteNumberDuplicates: quoteNumberDuplicates.length > 0 ? quoteNumberDuplicates : "none"
      },
      recommendations: generateRecommendations(columns, sNoDuplicates, quoteNumberDuplicates)
    });

  } catch (error) {
    console.error("Debug quotations schema error:", error);
    return NextResponse.json({
      status: "error",
      message: error.message
    }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { action } = await req.json();

    if (action !== "fix-schema") {
      return NextResponse.json({
        status: "error",
        message: "Invalid action. Use action: 'fix-schema'"
      }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Check current schema
    const [keyInfo] = await conn.execute(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records' 
       AND COLUMN_NAME = 's_no' AND CONSTRAINT_NAME = 'PRIMARY'`
    );

    const results = [];

    if (keyInfo.length > 0) {
      console.log("🔧 Dropping s_no PRIMARY KEY...");
      await conn.execute(`ALTER TABLE quotations_records DROP PRIMARY KEY`);
      results.push("✅ Dropped s_no PRIMARY KEY");

      // Check if quote_number already has a UNIQUE constraint
      const [quoteConstraints] = await conn.execute(
        `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records' 
         AND COLUMN_NAME = 'quote_number' AND CONSTRAINT_NAME != 'PRIMARY'`
      );

      if (quoteConstraints.length === 0) {
        console.log("🔧 Adding UNIQUE constraint to quote_number...");
        await conn.execute(`ALTER TABLE quotations_records ADD UNIQUE KEY uk_quote_number (quote_number(100))`);
        results.push("✅ Added UNIQUE constraint to quote_number");
      } else {
        results.push("ℹ️  quote_number already has a UNIQUE constraint");
      }

      // Make s_no an AUTO_INCREMENT UNIQUE key (not PRIMARY)
      console.log("🔧 Modifying s_no column...");
      await conn.execute(`ALTER TABLE quotations_records MODIFY s_no INT NOT NULL AUTO_INCREMENT UNIQUE`);
      results.push("✅ Modified s_no to AUTO_INCREMENT UNIQUE (not PRIMARY)");

    } else {
      results.push("ℹ️  s_no is not currently PRIMARY KEY. Schema appears OK.");
    }

    return NextResponse.json({
      status: "success",
      message: "Schema fix completed",
      actions: results
    });

  } catch (error) {
    console.error("Fix quotations schema error:", error);
    return NextResponse.json({
      status: "error",
      message: error.message,
      detail: error.sqlMessage
    }, { status: 500 });
  }
}

function generateRecommendations(columns, sNoDuplicates, quoteNumberDuplicates) {
  const recommendations = [];

  const sNoCol = columns.find(c => c.COLUMN_NAME === 's_no');
  const quoteCol = columns.find(c => c.COLUMN_NAME === 'quote_number');

  if (sNoCol && sNoCol.key === 'PRI') {
    recommendations.push({
      severity: "HIGH",
      message: "s_no is PRIMARY KEY - This may prevent new quotations from being inserted",
      action: "Use the POST endpoint with action='fix-schema' to fix this issue"
    });
  }

  if (sNoDuplicates.length > 0) {
    recommendations.push({
      severity: "HIGH",
      message: `Found ${sNoDuplicates.length} duplicate s_no values`,
      duplicates: sNoDuplicates
    });
  }

  if (quoteNumberDuplicates.length > 0) {
    recommendations.push({
      severity: "MEDIUM",
      message: `Found ${quoteNumberDuplicates.length} duplicate quote_number values`,
      duplicates: quoteNumberDuplicates,
      action: "Investigate and potentially clean up duplicate quote_number entries"
    });
  }

  if (!quoteCol || quoteCol.key !== 'UNI') {
    recommendations.push({
      severity: "MEDIUM",
      message: "quote_number doesn't have UNIQUE constraint",
      action: "add UNIQUE constraint to quote_number to ensure uniqueness"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: "INFO",
      message: "Schema appears to be properly configured"
    });
  }

  return recommendations;
}
