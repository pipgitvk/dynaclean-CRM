import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import EmployeeCardsClient from "./EmployeeCardsClient";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function EmployeeCardsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  } catch {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  let employees = [];
  let error = null;
  try {
    const conn = await getDbConnection();
    // Fetch only employees who are active in rep_list AND have expenses
    const [result] = await conn.execute(
      `SELECT DISTINCT r.username 
       FROM rep_list r
       INNER JOIN expenses e ON r.username = e.username
       WHERE r.status = 1 
       ORDER BY r.username ASC`
    );
    
    // Fetch expense statistics for each employee
    const employeeStats = {};
    for (const emp of result) {
      const username = emp.username;
      const [expenseData] = await conn.execute(
        `SELECT 
           ID,
           TravelDate,
           TicketCost,
           HotelCost,
           MealsCost,
           OtherExpenses,
           approved_amount,
           payment_date,
           approval_status
         FROM expenses
         WHERE username = ?
         ORDER BY TravelDate DESC`,
        [username]
      );
      
      let total = 0;
      let paid = 0;
      let pendingApproval = 0;
      let toPay = 0;
      
      for (const expense of expenseData) {
        const expenseTotal = Number(expense.TicketCost || 0) + 
                            Number(expense.HotelCost || 0) + 
                            Number(expense.MealsCost || 0) + 
                            Number(expense.OtherExpenses || 0);
        total += expenseTotal;
        
        if (expense.payment_date) {
          paid += expenseTotal;
        }
        
        if (expense.approval_status === 'Pending') {
          pendingApproval += expenseTotal;
        }
        
        if (expense.approval_status === 'Approved' && !expense.payment_date) {
          toPay += Number(expense.approved_amount || 0);
        }
      }
      
      employeeStats[username] = {
        total,
        paid,
        pendingApproval,
        toPay
      };
    }
    
    // Map to the expected structure with stats
    employees = result.map(emp => ({
      username: emp.username,
      name: emp.username,
      userRole: "Employee",
      email: "",
      stats: employeeStats[emp.username] || { total: 0, paid: 0, pendingApproval: 0, toPay: 0 }
    }));
  } catch (err) {
    console.error("[employee-cards] DB error:", err?.message);
    error = err.message;
  }

  if (error) {
    return <p className="text-red-600 p-4">Error: {error}</p>;
  }

  return <EmployeeCardsClient employees={employees} />;
}
