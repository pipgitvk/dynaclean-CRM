import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { getSessionPayload } from '@/lib/auth';

export async function GET(request) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (payload?.role || '').toUpperCase();
  if (role !== 'DIRECTOR' && role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const connection = await getDbConnection();

  try {
    // Task Pending count
    let taskPending = 0;
    try {
      const [taskResult] = await connection.execute(
        "SELECT COUNT(*) as count FROM task WHERE status = 'pending'"
      );
      taskPending = taskResult[0].count || 0;
    } catch (e) {
      console.error('Error fetching task count:', e);
    }

    // Stock Value (products_list using min_qty * price_per_unit)
    let stockValue = 0;
    try {
      // Try products_list first
      const [stockResult] = await connection.execute(
        "SELECT SUM(min_qty * price_per_unit) as total FROM products_list"
      );
      stockValue = stockResult[0].total || 0;
    } catch (e) {
      console.error('Error fetching stock value from products_list:', e);
      // Fallback: try products table
      try {
        const [fallbackStockResult] = await connection.execute(
          "SELECT SUM(stock * purchase_price) as total FROM products"
        );
        stockValue = fallbackStockResult[0].total || 0;
      } catch (e2) {
        console.error('Error fetching stock value from products:', e2);
      }
    }

    // Spare Value (stock_list)
    let spareValue = 0;
    try {
      const [spareResult] = await connection.execute(
        "SELECT SUM(quantity * amount_per_unit) as total FROM stock_list"
      );
      spareValue = spareResult[0].total || 0;
    } catch (e) {
      console.error('Error fetching spare value:', e);
    }

    // Date range logic
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let startDate, endDate;
    if (fromParam && toParam) {
      startDate = fromParam;
      endDate = toParam;
    } else if (monthParam) {
      // Clean the month param just in case (remove anything after a colon)
      const cleanMonth = monthParam.split(':')[0];
      startDate = `${cleanMonth}-01`;
      const [year, monthNum] = cleanMonth.split('-');
      const lastDay = new Date(year, monthNum, 0).getDate();
      endDate = `${cleanMonth}-${lastDay}`;
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${month}-${lastDay}`;
    }

    // Total Expenses for the range
    let totalExpenses = 0;
    try {
      const [expensesResult] = await connection.execute(
        "SELECT SUM(approved_amount) as total FROM expenses WHERE DATE(created_at) BETWEEN ? AND ?",
        [startDate, endDate]
      );
      totalExpenses = expensesResult[0].total || 0;
    } catch (e) {
      console.error('Error fetching expenses:', e);
    }

    // Total Expenses (all time)
    let totalExpensesAll = 0;
    try {
      const [fallbackResult] = await connection.execute(
        "SELECT SUM(COALESCE(approved_amount, 0)) as total FROM expenses"
      );
      totalExpensesAll = parseFloat(fallbackResult[0].total) || 0;
    } catch (e) {
      console.error('Error fetching all expenses:', e);
    }

    // Total Stock Purchase for the range
    let totalStockPurchase = 0;
    try {
      const [stockPurchaseResult] = await connection.execute(
        "SELECT SUM(purchase_price * quantity) as total FROM purchase WHERE type = 'stock' AND DATE(purchase_date) BETWEEN ? AND ?",
        [startDate, endDate]
      );
      totalStockPurchase = stockPurchaseResult[0].total || 0;
    } catch (e) {
      console.error('Error fetching stock purchase:', e);
    }

    // Total Stock Purchase (all time)
    let totalStockPurchaseAll = 0;
    try {
      const [stockPurchaseAllResult] = await connection.execute(
        "SELECT SUM(net_amount) as total FROM product_stock_request"
      );
      totalStockPurchaseAll = parseFloat(stockPurchaseAllResult[0].total) || 0;
    } catch (e) {
      console.error('Error fetching all stock purchase:', e);
    }

    // Total Spare Purchase for the range
    let totalSparePurchase = 0;
    try {
      const [sparePurchaseResult] = await connection.execute(
        "SELECT SUM(purchase_price * quantity) as total FROM purchase WHERE type = 'spare' AND DATE(purchase_date) BETWEEN ? AND ?",
        [startDate, endDate]
      );
      totalSparePurchase = sparePurchaseResult[0].total || 0;
    } catch (e) {
      console.error('Error fetching spare purchase:', e);
    }

    // Total Spare Purchase (all time)
    let totalSparePurchaseAll = 0;
    try {
      const [sparePurchaseAllResult] = await connection.execute(
        "SELECT SUM(net_amount) as total FROM spare_stock_request"
      );
      totalSparePurchaseAll = parseFloat(sparePurchaseAllResult[0].total) || 0;
    } catch (e) {
      console.error('Error fetching all spare purchase:', e);
    }

    // Total Sale for the range
    let totalSale = 0;
    try {
      const [saleResult] = await connection.execute(
        "SELECT SUM(total_amount) as total FROM orders WHERE DATE(created_at) BETWEEN ? AND ?",
        [startDate, endDate]
      );
      totalSale = saleResult[0].total || 0;
    } catch (e) {
      console.error('Error fetching sale:', e);
    }

    // Total Profit (Sale - Purchase)
    const totalProfit = (parseFloat(totalSale) || 0) - ((parseFloat(totalStockPurchase) || 0) + (parseFloat(totalSparePurchase) || 0));

    // Service KPIs
    let servicePending = 0, serviceCompleted = 0, servicePendingSpares = 0;
    try {
      // Use the same query as the service reports page for consistency
      const sql = `
        SELECT sr.*,
        wp.customer_name AS customer_name_from_wp,
        wp.contact_person AS contact_person_from_wp,
        wp.installed_address AS installed_address_from_wp,
        wp.email, wp.contact, wp.invoice_date, wp.product_name, wp.specification, wp.model,
        CASE
            WHEN sr_report.service_id IS NOT NULL THEN 1
            ELSE 0
        END AS view_status
        FROM service_records sr
        LEFT JOIN warranty_products wp ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
        LEFT JOIN service_reports sr_report ON sr.service_id = sr_report.service_id
      `;
      const [serviceResult] = await connection.execute(sql);
      const allRecords = serviceResult;
      console.log('Total service records fetched:', allRecords.length);
      
      serviceCompleted = allRecords.filter(r => r.status?.toUpperCase() === 'COMPLETED').length;
      servicePending = allRecords.filter(r => r.status?.toUpperCase() === 'PENDING').length;
      servicePendingSpares = allRecords.filter(r => r.status?.toUpperCase() === 'PENDING FOR SPARES').length;
      console.log('Service KPI query result - completed:', serviceCompleted, 'pending:', servicePending, 'pendingSpares:', servicePendingSpares);
    } catch (e) {
      console.error('Error fetching service KPIs:', e);
    }

    return NextResponse.json({
      taskPending,
      stockValue,
      spareValue,
      totalExpenses,
      totalExpensesAll,
      totalStockPurchase,
      totalStockPurchaseAll,
      totalSparePurchase,
      totalSparePurchaseAll,
      totalSale,
      totalProfit: totalProfit > 0 ? totalProfit : 0,
      servicePending,
      serviceCompleted,
      servicePendingSpares,
    });
  } catch (error) {
    console.error('Error fetching KPI data:', error);
    return NextResponse.json({ error: 'Failed to fetch KPI data', details: error.message }, { status: 500 });
  }
}
