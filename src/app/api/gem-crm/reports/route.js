import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import ExcelJS from "exceljs";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const role = payload.role;
    if (!["SUPERADMIN", "GEM"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - SUPERADMIN/GEM only" }, { status: 403 });
    }
    const currentEmpId = payload.empId || payload.id || null;
    if (role === "GEM" && !currentEmpId) {
      return NextResponse.json({ error: "Employee id missing in session." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("reportType") || "date-wise";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const employeeId = searchParams.get("employeeId") || "";
    const organisationId = searchParams.get("organisationId") || "";
    const platform = searchParams.get("platform") || "";
    const exportFormat = searchParams.get("export") || "json";

    const conn = await getDbConnection();

    let data = [];
    let fileName = "gem-crm-report";

    // Build WHERE conditions
    const conditions = [];
    const params = [];

    if (role === "GEM") {
      conditions.push("b.assigned_employee_id = ?");
      params.push(currentEmpId);
    }

    if (dateFrom) {
      conditions.push("b.created_at >= ?");
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push("b.created_at <= ?");
      params.push(dateTo);
    }

    if (employeeId && role !== "GEM") {
      conditions.push("b.assigned_employee_id = ?");
      params.push(employeeId);
    }

    if (organisationId) {
      conditions.push("b.organisation_id = ?");
      params.push(organisationId);
    }

    if (platform) {
      conditions.push("b.bidding_platform = ?");
      params.push(platform);
    }

    const whereClause = conditions.length > 0
      ? "WHERE " + conditions.join(" AND ")
      : "WHERE 1=1";

    switch (reportType) {
      case "date-wise":
        data = await getDateWiseReport(conn, whereClause, params);
        fileName = "bids-date-wise";
        break;

      case "employee-wise":
        data = await getEmployeeWiseReport(conn, whereClause, params);
        fileName = "bids-employee-wise";
        break;

      case "organisation-wise":
        data = await getOrganisationWiseReport(conn, whereClause, params);
        fileName = "bids-organisation-wise";
        break;

      case "platform-wise":
        data = await getPlatformWiseReport(conn, whereClause, params);
        fileName = "bids-platform-wise";
        break;

      case "won-lost":
        data = await getWonLostReport(conn, whereClause, params);
        fileName = "bids-won-lost";
        break;

      case "financial":
        data = await getFinancialReport(conn, whereClause, params);
        fileName = "bids-financial";
        break;

      default:
        data = await getDateWiseReport(conn, whereClause, params);
    }

    // Export to Excel if requested
    if (exportFormat === "excel") {
      return await exportToExcel(data, fileName);
    }

    return NextResponse.json({
      success: true,
      reportType,
      data,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

async function getDateWiseReport(conn, whereClause, params) {
  const [rows] = await conn.execute(`
    SELECT 
      DATE(b.created_at) as date,
      COUNT(*) as total_bids,
      SUM(CASE WHEN b.bid_status = 'won' THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN b.bid_status = 'lost' THEN 1 ELSE 0 END) as lost,
      SUM(CASE WHEN b.bid_status = 'submitted' THEN 1 ELSE 0 END) as submitted,
      COALESCE(SUM(b.estimated_bid_value), 0) as total_value,
      COALESCE(SUM(CASE WHEN b.bid_status = 'won' THEN b.estimated_bid_value ELSE 0 END), 0) as won_value
    FROM bids b
    ${whereClause}
    GROUP BY DATE(b.created_at)
    ORDER BY date DESC
  `, params);

  return rows;
}

async function getEmployeeWiseReport(conn, whereClause, params) {
  let rows = [];
  try {
    const [result] = await conn.execute(`
      SELECT 
        COALESCE(r.username, e.username, CONCAT('Employee #', b.assigned_employee_id)) as employee_name,
        b.assigned_employee_id as empId,
        COUNT(*) as total_bids,
        SUM(CASE WHEN b.bid_status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN b.bid_status = 'lost' THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN b.bid_status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        COALESCE(SUM(b.estimated_bid_value), 0) as total_value,
        COALESCE(SUM(CASE WHEN b.bid_status = 'won' THEN b.estimated_bid_value ELSE 0 END), 0) as won_value
      FROM bids b
      LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
      LEFT JOIN rep_list r ON b.assigned_employee_id = r.empId
      ${whereClause}
      GROUP BY b.assigned_employee_id, r.username, e.username
      ORDER BY total_bids DESC
    `, params);
    rows = result;
  } catch (e) {
    console.log("Employee-wise report query failed, trying without emplist:", e.message);
    const [result] = await conn.execute(`
      SELECT 
        COALESCE(CONCAT('Employee #', b.assigned_employee_id), '-') as employee_name,
        b.assigned_employee_id as empId,
        COUNT(*) as total_bids,
        SUM(CASE WHEN b.bid_status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN b.bid_status = 'lost' THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN b.bid_status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        COALESCE(SUM(b.estimated_bid_value), 0) as total_value,
        COALESCE(SUM(CASE WHEN b.bid_status = 'won' THEN b.estimated_bid_value ELSE 0 END), 0) as won_value
      FROM bids b
      ${whereClause}
      GROUP BY b.assigned_employee_id
      ORDER BY total_bids DESC
    `, params);
    rows = result;
  }

  return rows;
}

async function getOrganisationWiseReport(conn, whereClause, params) {
  const [rows] = await conn.execute(`
    SELECT 
      b.organisation_id,
      COUNT(*) as total_bids,
      SUM(CASE WHEN b.bid_status = 'won' THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN b.bid_status = 'lost' THEN 1 ELSE 0 END) as lost,
      COALESCE(SUM(b.estimated_bid_value), 0) as total_value,
      COALESCE(SUM(CASE WHEN b.bid_status = 'won' THEN b.estimated_bid_value ELSE 0 END), 0) as won_value
    FROM bids b
    ${whereClause}
    GROUP BY b.organisation_id
    ORDER BY total_bids DESC
  `, params);

  return rows;
}

async function getPlatformWiseReport(conn, whereClause, params) {
  const [rows] = await conn.execute(`
    SELECT 
      COALESCE(b.bidding_platform, 'Other') as platform,
      COUNT(*) as total_bids,
      SUM(CASE WHEN b.bid_status = 'won' THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN b.bid_status = 'lost' THEN 1 ELSE 0 END) as lost,
      SUM(CASE WHEN b.bid_status = 'submitted' THEN 1 ELSE 0 END) as submitted,
      COALESCE(SUM(b.estimated_bid_value), 0) as total_value,
      COALESCE(SUM(CASE WHEN b.bid_status = 'won' THEN b.estimated_bid_value ELSE 0 END), 0) as won_value
    FROM bids b
    ${whereClause}
    GROUP BY b.bidding_platform
    ORDER BY total_bids DESC
  `, params);

  return rows;
}

async function getWonLostReport(conn, whereClause, params) {
  let rows = [];
  try {
    const [result] = await conn.execute(`
      SELECT 
        b.bid_id,
        b.bid_number,
        b.gem_bid_no,
        b.bid_title,
        b.bidding_platform,
        b.bid_status,
        b.technical_status,
        b.financial_status,
        b.estimated_bid_value,
        e.username as assigned_employee_name,
        b.created_at,
        b.updated_at
      FROM bids b
      LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
      ${whereClause}
      AND b.bid_status IN ('won', 'lost')
      ORDER BY b.updated_at DESC
    `, params);
    rows = result;
  } catch (e) {
    console.log("Won/lost report query failed, trying without emplist:", e.message);
    const [result] = await conn.execute(`
      SELECT 
        b.bid_id,
        b.bid_number,
        b.gem_bid_no,
        b.bid_title,
        b.bidding_platform,
        b.bid_status,
        b.technical_status,
        b.financial_status,
        b.estimated_bid_value,
        b.created_at,
        b.updated_at
      FROM bids b
      ${whereClause}
      AND b.bid_status IN ('won', 'lost')
      ORDER BY b.updated_at DESC
    `, params);
    rows = result;
  }

  return rows;
}

async function getFinancialReport(conn, whereClause, params) {
  let rows = [];
  try {
    const [result] = await conn.execute(`
      SELECT 
        b.bid_id,
        b.bid_number,
        b.gem_bid_no,
        b.bid_title,
        b.estimated_bid_value,
        b.emd_required,
        b.emd_amount,
        b.epbg_percentage,
        b.epbg_duration_months,
        b.bid_status,
        dd.party_name as dd_party_name,
        dd.amount as dd_amount,
        dd.status as dd_status,
        b.created_at
      FROM bids b
      LEFT JOIN dd_management dd ON b.dd_id = dd.id
      ${whereClause}
      ORDER BY b.estimated_bid_value DESC
    `, params);
    rows = result;
  } catch (e) {
    console.log("Financial report query failed, trying without dd_management:", e.message);
    const [result] = await conn.execute(`
      SELECT 
        b.bid_id,
        b.bid_number,
        b.gem_bid_no,
        b.bid_title,
        b.estimated_bid_value,
        b.emd_required,
        b.emd_amount,
        b.epbg_percentage,
        b.epbg_duration_months,
        b.bid_status,
        b.created_at
      FROM bids b
      ${whereClause}
      ORDER BY b.estimated_bid_value DESC
    `, params);
    rows = result;
  }

  return rows;
}

async function exportToExcel(data, fileName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");

  // Add headers
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => row[header]);
      worksheet.addRow(values);
    });

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}-${Date.now()}.xlsx"`,
    },
  });
}
