// app/api/admin-dashboard-stats/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  const conn = await getDbConnection();
  const { searchParams } = new URL(req.url);

  try {
    // Identify the logged-in user
    const session = await getSessionPayload();
    const username = session?.username || null;
    const role = session?.role || null;

    // Roles that can access admin dashboard
    const privilegedRoles = ["ADMIN", "SUPERADMIN"];

    if (!privilegedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    // Get date range from query params or default to current month
    const timeRange = searchParams.get("timeRange") || "thisMonth";
    let startDate, endDate;
    const today = new Date();

    switch (timeRange) {
      case "today":
        startDate = new Date(today.setHours(0, 0, 0, 0));
        endDate = new Date(today.setHours(23, 59, 59, 999));
        break;
      case "thisWeek":
        const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        startDate = new Date(firstDayOfWeek.setHours(0, 0, 0, 0));
        endDate = new Date();
        break;
      case "lastMonth":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "thisMonth":
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date();
        break;
    }

    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    // ===== 1. SALES STATISTICS =====
    const [salesStats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(COALESCE(totalamt, 0)) as total_revenue,
        COUNT(DISTINCT created_by) as active_salespeople
      FROM neworder
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `, [startDateStr, endDateStr]);

    // Get quotation to order conversion
    const [quotationStats] = await conn.execute(`
      SELECT COUNT(*) as total_quotations
      FROM quotations_records
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `, [startDateStr, endDateStr]);

    const conversionRate = quotationStats[0].total_quotations > 0
      ? ((salesStats[0].total_orders / quotationStats[0].total_quotations) * 100).toFixed(2)
      : 0;

    // Top performing salespeople
    const [topSalespeople] = await conn.execute(`
      SELECT 
        created_by as salesperson,
        COUNT(*) as orders_count,
        SUM(COALESCE(totalamt, 0)) as revenue
      FROM neworder
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
        AND created_by IS NOT NULL
      GROUP BY created_by
      ORDER BY revenue DESC
      LIMIT 5
    `, [startDateStr, endDateStr]);

    // ===== 2. DELIVERY STATISTICS =====
    const [deliveryStats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN delivery_status = 1 THEN 1 ELSE 0 END) as completed_deliveries,
        SUM(CASE 
          WHEN delivery_status = 0 
            AND client_delivery_date IS NOT NULL 
            AND DATE(client_delivery_date) < CURDATE() 
          THEN 1 ELSE 0 
        END) as delayed_deliveries,
        SUM(CASE 
          WHEN delivery_status = 0 
            AND (client_delivery_date IS NULL OR DATE(client_delivery_date) >= CURDATE())
          THEN 1 ELSE 0 
        END) as pending_deliveries
      FROM neworder
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `, [startDateStr, endDateStr]);

    const onTimeDeliveries = deliveryStats[0].completed_deliveries - deliveryStats[0].delayed_deliveries;

    // ===== 3. PAYMENT STATISTICS =====
    const [paymentStats] = await conn.execute(`
      SELECT 
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN payment_status = 'over due' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN payment_status = 'partially paid' THEN 1 END) as partial_count,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_count,
        SUM(CASE 
          WHEN payment_status IN ('pending', 'over due', 'partially paid') 
          THEN COALESCE(totalamt, 0) 
          ELSE 0 
        END) as total_pending_amount,
        SUM(CASE 
          WHEN payment_status = 'over due' 
          THEN COALESCE(totalamt, 0) 
          ELSE 0 
        END) as overdue_amount
      FROM neworder
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `, [startDateStr, endDateStr]);

    // ===== 4. SERVICE STATISTICS =====
    const [serviceStats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_services,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_services,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_services,
        COUNT(CASE WHEN status = 'PENDING FOR SPARES' THEN 1 END) as pending_for_spare,
        COUNT(CASE WHEN status = 'PENDING BY CUSTOMER' THEN 1 END) as pending_by_customer,
        COUNT(CASE WHEN service_type = 'INSTALLATION' THEN 1 END) as installation_services,
        COUNT(CASE WHEN service_type = 'SERVICE' THEN 1 END) as service_requests,
        COUNT(CASE WHEN service_type = 'WARRANTY' THEN 1 END) as warranty_services
      FROM service_records
      WHERE DATE(reg_date) >= ? AND DATE(reg_date) <= ?
    `, [startDateStr, endDateStr]);

    // Average service completion time (in days)
    const [avgCompletionTime] = await conn.execute(`
      SELECT 
        AVG(DATEDIFF(completed_date, reg_date)) as avg_days
      FROM service_records
      WHERE status = 'COMPLETED' 
        AND completed_date IS NOT NULL
        AND DATE(reg_date) >= ? AND DATE(reg_date) <= ?
    `, [startDateStr, endDateStr]);

    // ===== 5. INSTALLATION STATISTICS =====
    const [installationStats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_installations,
        SUM(CASE WHEN installation_status = 1 THEN 1 ELSE 0 END) as completed_installations,
        SUM(CASE WHEN installation_status = 0 THEN 1 ELSE 0 END) as pending_installations
      FROM neworder
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `, [startDateStr, endDateStr]);

    // Upcoming installations (next 10 days)
    const [upcomingInstallations] = await conn.execute(`
      SELECT 
        COUNT(*) as upcoming_count
      FROM neworder
      WHERE installation_status = 0
        AND delivery_date IS NOT NULL
        AND dispatch_status = 1
        AND DATE(delivery_date) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY)
    `);

    // Overdue installations
    const [overdueInstallations] = await conn.execute(`
      SELECT 
        COUNT(*) as overdue_count
      FROM neworder
      WHERE installation_status = 0
        AND delivery_date IS NOT NULL
        AND dispatch_status = 1
        AND DATE(delivery_date) < CURDATE()
    `);

    // ===== 6. TREND DATA FOR CHARTS =====
    // Sales trend (last 7 days or last 4 weeks depending on range)
    const [salesTrend] = await conn.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(COALESCE(totalamt, 0)) as revenue
      FROM neworder
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Service requests trend
    const [serviceTrend] = await conn.execute(`
      SELECT 
        DATE(reg_date) as date,
        COUNT(*) as count,
        service_type
      FROM service_records
      WHERE DATE(reg_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(reg_date), service_type
      ORDER BY date ASC
    `);

    // Return aggregated data
    return NextResponse.json({
      success: true,
      timeRange,
      data: {
        sales: {
          totalOrders: salesStats[0].total_orders || 0,
          totalRevenue: salesStats[0].total_revenue || 0,
          activeSalespeople: salesStats[0].active_salespeople || 0,
          conversionRate: parseFloat(conversionRate),
          topPerformers: topSalespeople
        },
        delivery: {
          totalDeliveries: deliveryStats[0].total_deliveries || 0,
          completedDeliveries: deliveryStats[0].completed_deliveries || 0,
          delayedDeliveries: deliveryStats[0].delayed_deliveries || 0,
          pendingDeliveries: deliveryStats[0].pending_deliveries || 0,
          onTimeDeliveries: onTimeDeliveries || 0,
          onTimeRate: deliveryStats[0].total_deliveries > 0
            ? ((onTimeDeliveries / deliveryStats[0].total_deliveries) * 100).toFixed(2)
            : 0
        },
        payments: {
          pendingCount: paymentStats[0].pending_count || 0,
          overdueCount: paymentStats[0].overdue_count || 0,
          partialCount: paymentStats[0].partial_count || 0,
          paidCount: paymentStats[0].paid_count || 0,
          totalPendingAmount: paymentStats[0].total_pending_amount || 0,
          overdueAmount: paymentStats[0].overdue_amount || 0
        },
        services: {
          totalServices: serviceStats[0].total_services || 0,
          completedServices: serviceStats[0].completed_services || 0,
          pendingServices: serviceStats[0].pending_services || 0,
          pendingForSpare: serviceStats[0].pending_for_spare || 0,
          pendingByCustomer: serviceStats[0].pending_by_customer || 0,
          installationServices: serviceStats[0].installation_services || 0,
          serviceRequests: serviceStats[0].service_requests || 0,
          warrantyServices: serviceStats[0].warranty_services || 0,
          avgCompletionDays: avgCompletionTime[0]?.avg_days
            ? parseFloat(avgCompletionTime[0].avg_days).toFixed(1)
            : 0
        },
        installations: {
          totalInstallations: installationStats[0].total_installations || 0,
          completedInstallations: installationStats[0].completed_installations || 0,
          pendingInstallations: installationStats[0].pending_installations || 0,
          upcomingInstallations: upcomingInstallations[0].upcoming_count || 0,
          overdueInstallations: overdueInstallations[0].overdue_count || 0
        },
        trends: {
          sales: salesTrend,
          services: serviceTrend
        }
      }
    });

  } catch (error) {
    console.error("Admin Dashboard Stats Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics", details: error.message },
      { status: 500 }
    );
  }
}
