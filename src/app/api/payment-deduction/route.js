import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePaymentDeductionsTable } from "@/lib/ensurePaymentDeductionsTable";
import {
  defaultClaimableForType,
  getOrderPaymentBreakdown,
  refreshOrderPaymentStatus,
} from "@/lib/paymentOrderStatus";

const ALLOWED_ROLES = ["ACCOUNTANT", "PRODUCTION ACCOUNTANT", "ADMIN", "SUPERADMIN"];
const VIEW_ROLES = [...ALLOWED_ROLES, "HR HEAD", "SALES", "SALES CUM BACKOFFICE", "TEAM LEADER", "DIRECTOR"];

function buildSummary(rows) {
  let totalDeduction = 0;
  let claimableAmount = 0;
  let claimedAmount = 0;
  let notClaimableAmount = 0;

  for (const row of rows) {
    const amount = parseFloat(row.amount || 0);
    totalDeduction += amount;

    if (Number(row.claimable) === 1) {
      claimableAmount += amount;
      if (String(row.claim_status || "").toLowerCase() === "received") {
        claimedAmount += amount;
      }
    } else {
      notClaimableAmount += amount;
    }
  }

  return {
    total_deduction: totalDeduction,
    claimable_amount: claimableAmount,
    claimed_amount: claimedAmount,
    pending_claim_amount: claimableAmount - claimedAmount,
    not_claimable_amount: notClaimableAmount,
  };
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = payload.role || "";
    if (!VIEW_ROLES.includes(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const deductionType = (searchParams.get("deduction_type") || "").trim();
    const claimableFilter = (searchParams.get("claimable") || "all").trim().toLowerCase();
    const claimStatusFilter = (searchParams.get("claim_status") || "all").trim().toLowerCase();
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const orderId = (searchParams.get("order_id") || "").trim();

    const pool = await getDbConnection();
    await ensurePaymentDeductionsTable();

    let sql = `
      SELECT
        pd.id,
        pd.order_id,
        pd.deduction_type,
        pd.remarks,
        pd.amount,
        pd.recorded_by,
        pd.recorded_date,
        pd.claimable,
        pd.claim_status,
        pd.claim_received_date,
        o.client_name,
        o.company_name,
        o.contact,
        COALESCE(NULLIF(TRIM(o.delivery_location), ''), NULLIF(TRIM(o.company_address), '')) AS address
      FROM payment_deductions pd
      INNER JOIN neworder o ON o.order_id COLLATE utf8mb4_unicode_ci = pd.order_id COLLATE utf8mb4_unicode_ci
      WHERE 1=1
    `;
    const params = [];

    if (orderId) {
      sql += ` AND pd.order_id COLLATE utf8mb4_unicode_ci = ?`;
      params.push(orderId);
    }

    if (deductionType && deductionType !== "all") {
      sql += ` AND pd.deduction_type = ?`;
      params.push(deductionType);
    }

    if (claimableFilter === "yes") {
      sql += ` AND pd.claimable = 1`;
    } else if (claimableFilter === "no") {
      sql += ` AND (pd.claimable = 0 OR pd.claimable IS NULL)`;
    }

    if (claimStatusFilter === "received") {
      sql += ` AND LOWER(COALESCE(pd.claim_status, '')) = 'received'`;
    } else if (claimStatusFilter === "not received") {
      sql += ` AND LOWER(COALESCE(pd.claim_status, '')) != 'received'`;
    }

    if (dateFrom) {
      sql += ` AND DATE(pd.recorded_date) >= ?`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ` AND DATE(pd.recorded_date) <= ?`;
      params.push(dateTo);
    }

    if (search) {
      sql += ` AND (
        LOWER(pd.order_id) LIKE ?
        OR LOWER(COALESCE(o.client_name, '')) LIKE ?
        OR LOWER(COALESCE(o.company_name, '')) LIKE ?
        OR LOWER(COALESCE(o.contact, '')) LIKE ?
        OR LOWER(COALESCE(pd.remarks, '')) LIKE ?
      )`;
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }

    sql += ` ORDER BY pd.recorded_date DESC, pd.id DESC`;

    const [rows] = await pool.query(sql, params);
    const deductions = (rows || []).map((row) => ({
      id: row.id,
      order_id: row.order_id,
      party_name: row.client_name || row.company_name || "",
      company_name: row.company_name || "",
      address: row.address || "",
      contact: row.contact || "",
      amount: parseFloat(row.amount || 0),
      deduction_type: row.deduction_type,
      remarks: row.remarks || "",
      claimable: Number(row.claimable) === 1,
      claim_status: row.claim_status || "not received",
      claim_received_date: row.claim_received_date || null,
      recorded_by: row.recorded_by || "",
      recorded_date: row.recorded_date || null,
    }));

    const canViewSummary = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "PRODUCTION ACCOUNTANT"].includes(role);

    return NextResponse.json({
      success: true,
      deductions,
      summary: canViewSummary ? buildSummary(deductions) : null,
      userRole: role,
    });
  } catch (error) {
    console.error("Error fetching deductions:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = payload.username || null;
    const role = payload.role || "";
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { order_id, deduction_type, remarks, amount, claimable } = body;
    const deductionAmount = parseFloat(amount);

    if (!order_id || !deduction_type || !String(remarks || "").trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!Number.isFinite(deductionAmount) || deductionAmount <= 0) {
      return NextResponse.json(
        { error: "Deduction amount must be greater than 0" },
        { status: 400 }
      );
    }

    const allowedTypes = ["LD", "SD", "TDS", "Others"];
    if (!allowedTypes.includes(deduction_type)) {
      return NextResponse.json({ error: "Invalid deduction type" }, { status: 400 });
    }

    const conn = await getDbConnection();
    await ensurePaymentDeductionsTable();

    const breakdown = await getOrderPaymentBreakdown(conn, order_id);
    if (!breakdown) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (deductionAmount > breakdown.remainingAmount) {
      return NextResponse.json(
        { error: "Deduction cannot be more than remaining amount" },
        { status: 400 }
      );
    }

    const isClaimable =
      claimable === undefined || claimable === null
        ? defaultClaimableForType(deduction_type)
        : Boolean(claimable);

    await conn.execute(
      `INSERT INTO payment_deductions
       (order_id, deduction_type, remarks, amount, recorded_by, recorded_date, claimable, claim_status)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, 'not received')`,
      [
        order_id,
        deduction_type,
        String(remarks).trim(),
        deductionAmount,
        currentUser,
        isClaimable ? 1 : 0,
      ]
    );

    const updatedBreakdown = await refreshOrderPaymentStatus(conn, order_id);

    return NextResponse.json(
      {
        success: true,
        message: "Deduction recorded successfully",
        payment_status: updatedBreakdown?.paymentStatus || null,
        remaining_amount: updatedBreakdown?.remainingAmount ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error recording deduction:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
