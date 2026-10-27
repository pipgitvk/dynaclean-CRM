import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

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
    const bidWhere = role === "GEM" ? "WHERE assigned_employee_id = ?" : "";
    const bidAnd = role === "GEM" ? "AND assigned_employee_id = ?" : "";
    const bidParams = role === "GEM" ? [currentEmpId] : [];

    const conn = await getDbConnection();

    // Get basic counts
    const [totalBids] = await conn.execute(
      `SELECT COUNT(*) as count FROM bids ${bidWhere}`,
      bidParams
    );

    const [statusCounts] = await conn.execute(`
      SELECT 
        bid_status,
        COUNT(*) as count
      FROM bids
      ${bidWhere}
      GROUP BY bid_status
    `, bidParams);

    const [technicalStatusCounts] = await conn.execute(`
      SELECT 
        technical_status,
        COUNT(*) as count
      FROM bids
      ${bidWhere}
      GROUP BY technical_status
    `, bidParams);

    const [financialStatusCounts] = await conn.execute(`
      SELECT 
        financial_status,
        COUNT(*) as count
      FROM bids
      ${bidWhere}
      GROUP BY financial_status
    `, bidParams);

    // Get total bid value
    const [totalValue] = await conn.execute(
      `SELECT COALESCE(SUM(estimated_bid_value), 0) as total FROM bids ${bidWhere}`,
      bidParams
    );

    // Get won bids total value (use actual order value if available, else estimated bid value)
    let wonBidValue = 0;
    try {
      // First, get all order_ids from won bids
      const [wonBidsOrders] = await conn.execute(`
        SELECT order_id
        FROM bids
        WHERE bid_status = 'won'
        AND order_id IS NOT NULL
        AND order_id != ''
        ${role === "GEM" ? "AND assigned_employee_id = ?" : ""}
      `, bidParams);

      if (wonBidsOrders.length > 0) {
        const orderIds = wonBidsOrders.map(b => b.order_id);
        const placeholders = orderIds.map(() => '?').join(',');

        // Get totalamt from neworder for these order_ids
        const [orderValues] = await conn.execute(`
          SELECT COALESCE(SUM(totalamt), 0) as total
          FROM neworder
          WHERE order_id IN (${placeholders})
        `, orderIds);

        wonBidValue = parseFloat(orderValues[0].total) || 0;
      }

      // If no orders found, fall back to estimated bid value
      if (wonBidValue === 0) {
        const [wonValue] = await conn.execute(
          `SELECT COALESCE(SUM(estimated_bid_value), 0) as total FROM bids WHERE bid_status = 'won' ${bidAnd}`,
          bidParams
        );
        wonBidValue = parseFloat(wonValue[0].total) || 0;
      }
    } catch (e) {
      console.log("Won bid value calculation failed:", e.message);
      // Fallback to original query
      const [wonValue] = await conn.execute(
        `SELECT COALESCE(SUM(estimated_bid_value), 0) as total FROM bids WHERE bid_status = 'won' ${bidAnd}`,
        bidParams
      );
      wonBidValue = parseFloat(wonValue[0].total) || 0;
    }

    // Get orders created from bids (safe query - handle if bid_id column doesn't exist)
    let orderStats = [{ order_count: 0, order_amount: 0 }];
    try {
      // First, get all order_ids from won bids
      const [wonBidsOrders] = await conn.execute(`
        SELECT order_id 
        FROM bids 
        WHERE bid_status = 'won' 
        AND order_id IS NOT NULL 
        AND order_id != ''
        ${role === "GEM" ? "AND assigned_employee_id = ?" : ""}
      `, bidParams);

      if (wonBidsOrders.length > 0) {
        const orderIds = wonBidsOrders.map(b => b.order_id);
        const placeholders = orderIds.map(() => '?').join(',');
        
        const [orderResult] = await conn.execute(`
          SELECT 
            COUNT(*) as order_count,
            COALESCE(SUM(totalamt), 0) as order_amount
          FROM neworder
          WHERE order_id IN (${placeholders})
        `, orderIds);
        orderStats = orderResult;
      }
    } catch (e) {
      console.log("Order stats query failed:", e.message);
    }

    // Get active EMD count (linked to bids) - safe query
    let emdStats = [{ active_emd_count: 0, total_emd_amount: 0 }];
    try {
      const [emdResult] = await conn.execute(`
        SELECT 
          COUNT(*) as active_emd_count,
          COALESCE(SUM(amount), 0) as total_emd_amount
        FROM dd_records dd
        INNER JOIN bids b ON dd.id = b.dd_id
        WHERE dd.type = 'DD' AND dd.status IN ('Assigned', 'Filled', 'Issued')
        ${role === "GEM" ? "AND b.assigned_employee_id = ?" : ""}
      `, bidParams);
      emdStats = emdResult;
    } catch (e) {
      console.log("EMD stats query failed:", e.message);
    }

    // Get active BG count (linked to bids) - safe query
    let bgStats = [{ active_bg_count: 0, total_bg_amount: 0 }];
    try {
      const [bgResult] = await conn.execute(`
        SELECT 
          COUNT(*) as active_bg_count,
          COALESCE(SUM(amount), 0) as total_bg_amount
        FROM dd_records dd
        INNER JOIN bids b ON dd.id = b.dd_id
        WHERE dd.type = 'BG' AND dd.status IN ('Assigned', 'Filled', 'Issued')
        ${role === "GEM" ? "AND b.assigned_employee_id = ?" : ""}
      `, bidParams);
      bgStats = bgResult;
    } catch (e) {
      console.log("BG stats query failed:", e.message);
    }

    // Get monthly bids for chart
    const [monthlyBids] = await conn.execute(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        COALESCE(SUM(estimated_bid_value), 0) as value
      FROM bids
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) ${bidAnd}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `, bidParams);

    // Get platform-wise bids
    const [platformBids] = await conn.execute(`
      SELECT 
        COALESCE(bidding_platform, 'Other') as platform,
        COUNT(*) as count,
        COALESCE(SUM(estimated_bid_value), 0) as value
      FROM bids
      ${bidWhere}
      GROUP BY bidding_platform
      ORDER BY count DESC
    `, bidParams);

    // Get win/loss ratio
    const [winLoss] = await conn.execute(`
      SELECT 
        SUM(CASE WHEN bid_status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN bid_status = 'lost' THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN bid_status IN ('won', 'lost') THEN 1 ELSE 0 END) as total
      FROM bids
      ${bidWhere}
    `, bidParams);

    // Get bids ending within 1 week
    const [endingSoon] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM bids
      WHERE bid_end_date IS NOT NULL
        AND bid_end_date >= CURDATE()
        AND bid_end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        ${bidAnd}
    `, bidParams);

    // Get bids with active RA period (today between RA start and end date)
    const [activeRA] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM bids
      WHERE bid_status = 'ra_participated'
        AND ra_start_date IS NOT NULL
        AND ra_end_date IS NOT NULL
        AND CURDATE() >= ra_start_date
        AND CURDATE() <= ra_end_date
        ${bidAnd}
    `, bidParams);

    // Get employee-wise bid counts (safe query)
    let employeeBids = [];
    try {
      const [employeeResult] = await conn.execute(`
        SELECT 
          COALESCE(r.username, e.username, CONCAT('Employee #', b.assigned_employee_id)) as employee_name,
          COUNT(*) as bid_count,
          COALESCE(SUM(b.estimated_bid_value), 0) as total_value,
          SUM(CASE WHEN b.bid_status = 'won' THEN 1 ELSE 0 END) as won_count
        FROM bids b
        LEFT JOIN emplist e ON b.assigned_employee_id = e.empId
        LEFT JOIN rep_list r ON b.assigned_employee_id = r.empId
        WHERE b.assigned_employee_id IS NOT NULL ${role === "GEM" ? "AND b.assigned_employee_id = ?" : ""}
        GROUP BY b.assigned_employee_id, r.username, e.username
        ORDER BY bid_count DESC
        LIMIT 10
      `, bidParams);
      employeeBids = employeeResult;
    } catch (e) {
      console.log("Employee stats query failed:", e.message);
    }

    await conn.end();

    // Format status counts into object
    const statusMap = {};
    statusCounts.forEach(row => {
      statusMap[row.bid_status] = row.count;
    });

    const technicalStatusMap = {};
    technicalStatusCounts.forEach(row => {
      technicalStatusMap[row.technical_status] = row.count;
    });

    const financialStatusMap = {};
    financialStatusCounts.forEach(row => {
      financialStatusMap[row.financial_status] = row.count;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalBids: totalBids[0].count,
        statusCounts: statusMap,
        technicalStatusCounts: technicalStatusMap,
        financialStatusCounts: financialStatusMap,
        totalBidValue: parseFloat(totalValue[0].total) || 0,
        wonBidValue: wonBidValue,
        participated: statusMap['submitted'] || 0 + statusMap['technical_qualified'] || 0 + statusMap['ra_participated'] || 0,
        won: statusMap['won'] || 0,
        lost: statusMap['lost'] || 0,
        cancelled: statusMap['cancelled'] || 0,
        disqualified: (technicalStatusMap['disqualified'] || 0) + (financialStatusMap['disqualified'] || 0),
        orderCount: orderStats[0].order_count || 0,
        orderAmount: parseFloat(orderStats[0].order_amount) || 0,
        activeEmdCount: emdStats[0].active_emd_count || 0,
        activeBgCount: bgStats[0].active_bg_count || 0,
        winLossRatio: {
          won: winLoss[0].won || 0,
          lost: winLoss[0].lost || 0,
          total: winLoss[0].total || 0,
          winRate: winLoss[0].total > 0 
            ? ((winLoss[0].won / winLoss[0].total) * 100).toFixed(2) 
            : 0,
        },
        endingSoon: endingSoon[0].count || 0,
        activeRA: activeRA[0].count || 0,
        monthlyBids,
        platformBids,
        employeeBids,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
