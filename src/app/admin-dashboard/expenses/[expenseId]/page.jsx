import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Link from "next/link";
import FallbackLink from "@/components/attachments/FallbackLink";
import dayjs from "dayjs";
import ApproveModal from "@/components/expenses/ApproveModal";

export const dynamic = "force-dynamic";

async function getExpenseById(expenseId) {
  const connection = await getDbConnection();

  const [rows] = await connection.execute(
    "SELECT * FROM expenses WHERE ID = ?",
    [expenseId],
  );
  // await connection.end();
  return rows[0];
}

export default async function ExpenseDetailPage({ params }) {
  const expenseId = params.expenseId;
  const expense = await getExpenseById(expenseId);
  if (!expense)
    return (
      <div className="p-6 text-center text-red-600">Expense not found</div>
    );
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let loggedInUser = "unknown";
  let role = "unknown";
  if (token) {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    );
    console.log("**************************************");
    console.log("this is the role:", payload);

    loggedInUser = payload.username;
    role = payload.role;
  }

  const total =
    Number(expense.TicketCost) +
    Number(expense.HotelCost) +
    Number(expense.MealsCost) +
    Number(expense.OtherExpenses);

  // Split attachments string by comma and filter out any empty strings
  // This assumes the attachments are stored as '/path1.jpg, /path2.pdf'
  const attachments = expense.attachments?.split(", ").filter(Boolean) || [];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
        Expense Details
      </h2>

      {/* DETAILS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm sm:text-base">
        <div className="space-y-2 bg-gray-50 p-4 rounded shadow-sm">
          <p>
            <span className="font-medium">Status:</span>{" "}
            <span className="text-blue-600">
              {expense.approval_status || "Pending"}
            </span>
          </p>
          <p>
            <span className="font-medium">Username:</span> {expense.username}
          </p>
          <p>
            <span className="font-medium">Approval Date:</span>{" "}
            {expense.approval_date
              ? dayjs(expense.approval_date).format("DD MMM YYYY")
              : "-"}
          </p>
          <p>
            <span className="font-medium">From:</span> {expense.FromLocation}
          </p>
          <p>
            <span className="font-medium">To:</span> {expense.Tolocation}
          </p>
          <p>
            <span className="font-medium">Description:</span>{" "}
            {expense.description}
          </p>
          <p className="text-green-600 font-semibold">
            <span className="font-medium">Total:</span> ₹{total.toFixed(2)}
          </p>
        </div>

        <div className="space-y-2 bg-gray-50 p-4 rounded shadow-sm">
          <p>
            <span className="font-medium">Meeting Person:</span>{" "}
            {expense.person_name}
          </p>
          <p>
            <span className="font-medium">Contact:</span>{" "}
            {expense.person_contact}
          </p>
          <p>
            <span className="font-medium">Mode:</span> {expense.ConveyanceMode}
          </p>
          <p>
            <span className="font-medium">Distance:</span> {expense.distance} Km
          </p>
          <p>
            <span className="font-medium">Ticket:</span> ₹
            {Number(expense.TicketCost).toFixed(2)}
          </p>
          <p>
            <span className="font-medium">Hotel:</span> ₹
            {Number(expense.HotelCost).toFixed(2)}
          </p>
          <p>
            <span className="font-medium">Meals:</span> ₹
            {Number(expense.MealsCost).toFixed(2)}
          </p>
          <p>
            <span className="font-medium">Other:</span> ₹
            {Number(expense.OtherExpenses).toFixed(2)}
          </p>
          <p>
            <span className="font-medium">Approved Amt:</span> ₹
            {Number(expense.approved_amount || 0).toFixed(2)}
          </p>
          <p>
            <span className="font-medium">Approved By:</span>{" "}
            {expense.approved_by || "-"}
          </p>
          <p>
            <span className="font-medium">Travel Date:</span>{" "}
            {expense.TravelDate
              ? dayjs(expense.TravelDate).format("DD MMM YYYY")
              : "-"}
          </p>
        </div>
      </div>

      {/* ATTACHMENTS */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold mb-3">Attachments</h3>
        {attachments.length === 0 ? (
          <p className="text-gray-500 italic">No attachments available</p>
        ) : (
          <ul className="list-disc ml-6 space-y-2 text-sm text-blue-700">
            {attachments.map((filePath, index) => {
              // Normalize to path-only, in case DB stored a full URL
              let pathOnly = filePath || "";
              try {
                if (pathOnly.startsWith("http")) {
                  const u = new URL(pathOnly);
                  pathOnly = u.pathname.startsWith("/")
                    ? u.pathname
                    : `/${u.pathname}`;
                }
              } catch {}

              // Ensure path starts with '/'
              if (pathOnly && !pathOnly.startsWith("/")) {
                pathOnly = `/${pathOnly}`;
              }

              const fileName = pathOnly.split("/").pop();

              return (
                <li key={index}>
                  <FallbackLink pathOnly={pathOnly} fileName={fileName} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mt-10">
        <Link
          href={
            role === "ACCOUNTANT" || role === "ADMIN" || role === "HR_MANAGER"
              ? "/user-dashboard/all-expenses"
              : "/user-dashboard/expenses"
          }
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center"
        >
          Back
        </Link>

        <Link
          href={`/user-dashboard/expenses/edit/${expenseId}`}
          className="inline-block px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-center"
        >
          Edit
        </Link>

        {(role === "ACCOUNTANT" || role === "ADMIN" || role === "HR_MANAGER") &&
          (!expense.approval_status ||
            expense.approval_status === "Pending") && (
            <ApproveModal
              expenseId={expenseId}
              initialAmount={total}
              approver={loggedInUser}
            />
          )}
      </div>
    </div>
  );
}
