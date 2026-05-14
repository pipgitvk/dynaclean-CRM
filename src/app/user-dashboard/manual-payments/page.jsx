import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import PaymentTable from "./PaymentTable";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function ManualPaymentsPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    let username = "";
    let role = "";

    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(JWT_SECRET)
        );

        username = payload.username;
        role = payload.role;

        // Check if user has access
        if (!["ACCOUNTANT", "ADMIN", "SUPERADMIN"].includes(role)) {
            return (
                <div className="p-6">
                    <p className="text-red-600">Access Denied. This page is only accessible to Accountant, Admin, and Superadmin roles.</p>
                </div>
            );
        }
    } catch (err) {
        redirect("/login");
    }

    const conn = await getDbConnection();

    // Fetch all payment entries
    const [rows] = await conn.execute(`
    SELECT * FROM manual_payment_pending 
    ORDER BY created_at DESC
  `);

    // Get statistics
    const [stats] = await conn.execute(`
    SELECT 
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'received' THEN 1 END) as received_count,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
      COALESCE(SUM(CASE WHEN status = 'received' THEN amount ELSE 0 END), 0) as received_amount,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
    FROM manual_payment_pending
  `);

    return (
        <div className="max-w-full mx-auto p-4 md:p-6">
            <div className="mb-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                        Manual Payment Entries
                    </h1>
                    <a
                        href="/user-dashboard/manual-payments/add"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg shadow-md transition-colors text-center font-medium"
                    >
                        + Add New Payment
                    </a>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-yellow-700">Pending Payments</p>
                                <p className="text-2xl font-bold text-yellow-900">{stats[0].pending_count}</p>
                            </div>
                            <div className="bg-yellow-200 rounded-full p-3">
                                <svg className="w-6 h-6 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-green-700">Received Payments</p>
                                <p className="text-2xl font-bold text-green-900">{stats[0].received_count}</p>
                            </div>
                            <div className="bg-green-200 rounded-full p-3">
                                <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-orange-700">Pending Amount</p>
                                <p className="text-2xl font-bold text-orange-900">₹{parseFloat(stats[0].pending_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-orange-200 rounded-full p-3">
                                <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-blue-700">Received Amount</p>
                                <p className="text-2xl font-bold text-blue-900">₹{parseFloat(stats[0].received_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-blue-200 rounded-full p-3">
                                <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PaymentTable rows={rows} role={role} />
        </div>
    );
}
