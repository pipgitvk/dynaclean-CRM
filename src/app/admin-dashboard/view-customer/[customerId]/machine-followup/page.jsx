import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const dynamic = "force-dynamic";

const IST = "Asia/Kolkata";

const ALLOWED_ROLES = ["SUPERADMIN", "SALES", "SALES HEAD", "SALES CUM BACKOFFICE"];

export default async function MachineFollowupPage({ params }) {
  const { customerId } = await params;

  // Auth check
  const payload = await getSessionPayload();
  if (!payload) redirect("/login");

  const roleUpper = String(payload.role || "").toUpperCase().trim();
  if (!ALLOWED_ROLES.includes(roleUpper)) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center text-red-600 font-semibold">
        Access denied.
      </div>
    );
  }

  const conn = await getDbConnection();

  // Fetch customer name + phone
  const [[customer]] = await conn.execute(
    `SELECT customer_id, first_name, last_name, phone FROM customers WHERE customer_id = ?`,
    [customerId]
  );
  if (!customer) notFound();

  const phone = customer.phone ? String(customer.phone).trim() : "";
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();

  let matchedWarrantyProducts = [];
  let machineFollowupRecords = [];

  if (phone) {
    // Normalise customer phone to last 10 digits
    const phoneDigits = phone.replace(/\D/g, "").slice(-10);

    // Helper: match any comma-or-slash-separated segment's last 10 digits against a column
    // First replace '/' with ',' so both separators are handled uniformly
    const segmentMatch = (col, n) =>
      `RIGHT(REGEXP_REPLACE(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(${col}, '/', ','), ',', ${n}), ',', -1)), '[^0-9]', ''), 10) = ?`;

    // Build per-column OR block for up to 5 comma-separated numbers
    const contactMatchBlock = (col) =>
      `(${[1,2,3,4,5].map((n) => segmentMatch(col, n)).join(" OR ")})`;

    // Step 1: find warranty products matching by contact phone
    const [wpRows] = await conn.execute(
      `SELECT serial_number, product_name, model, contact
       FROM warranty_products
       WHERE ${contactMatchBlock("contact")}
         AND serial_number IS NOT NULL AND serial_number != ''`,
      [phoneDigits, phoneDigits, phoneDigits, phoneDigits, phoneDigits]
    );
    matchedWarrantyProducts = wpRows;

    // Collect serial numbers from matched warranty products
    const serials = wpRows.map((r) => String(r.serial_number).trim());

    // Step 2: fetch machines_followup rows where:
    //   - serial_number matches any of the warranty product serials  (OR)
    //   - contact field itself contains the customer phone (handles cases where
    //     machines_followup was entered with a contact not in warranty_products)
    const serialPlaceholders = serials.length > 0 ? serials.map(() => "?").join(",") : null;

    const [mfRows] = await conn.execute(
      `SELECT * FROM machines_followup
       WHERE ${serialPlaceholders ? `TRIM(serial_number) IN (${serialPlaceholders}) OR` : ""}
             ${contactMatchBlock("contact")}
       ORDER BY id DESC`,
      [
        ...(serials.length > 0 ? serials : []),
        phoneDigits, phoneDigits, phoneDigits, phoneDigits, phoneDigits,
      ]
    );
    machineFollowupRecords = mfRows;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href={`/admin-dashboard/view-customer/${customerId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Back to Customer
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-1">Machine Follow-up History</h1>
      <p className="text-sm text-gray-500 mb-6">
        Customer: <span className="font-semibold text-gray-700">{customerName}</span>
        {phone && (
          <span className="ml-2 text-gray-400">· {phone}</span>
        )}
      </p>

      {/* Matched warranty products */}
      {matchedWarrantyProducts.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {matchedWarrantyProducts.map((wp) => (
            <span
              key={wp.serial_number}
              className="inline-flex items-center gap-1.5 text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-full px-3 py-1"
            >
              🔧 <span className="font-semibold">{wp.model || wp.product_name}</span>
              <span className="text-purple-400">·</span>
              <span className="font-mono">{wp.serial_number}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-700 font-medium">No warranty products found matching this customer's contact number.</p>
          <p className="text-yellow-500 text-sm mt-1">
            Make sure the phone number on the warranty product matches: <span className="font-mono font-semibold">{phone || "—"}</span>
          </p>
        </div>
      )}

      {/* History */}
      {machineFollowupRecords.length === 0 && matchedWarrantyProducts.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-500">No follow-up records found for the matched machines.</p>
        </div>
      )}

      {machineFollowupRecords.length > 0 && (
        <div className="bg-white shadow-md rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-block w-3 h-3 rounded-full bg-purple-500" />
            <h2 className="text-lg font-semibold text-gray-800">Follow-up Records</h2>
            <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {machineFollowupRecords.length} record{machineFollowupRecords.length !== 1 ? "s" : ""}
            </span>
          </div>

          <ol className="relative border-l-2 border-purple-200 ml-2">
            {machineFollowupRecords.map((rec, idx) => (
              <li key={rec.id} className="mb-6 ml-5">
                <span
                  className={`absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${
                    idx === 0 ? "bg-purple-600" : "bg-gray-400"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white" />
                </span>

                <div
                  className={`p-4 rounded-lg border ${
                    idx === 0
                      ? "bg-purple-50 border-purple-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <span className="text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">
                          Latest
                        </span>
                      )}
                      <span className="text-xs text-gray-400">#{rec.id}</span>
                      {rec.serial_number && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                          {rec.serial_number}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      By <span className="font-semibold text-gray-700">{rec.added_by}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Followed At:</span>{" "}
                      <span className="font-medium">
                        {rec.followed_at
                          ? dayjs(rec.followed_at).tz(IST).format("DD MMM YYYY, HH:mm")
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Next Follow-up:</span>{" "}
                      <span className="font-medium">
                        {rec.next_followup_date
                          ? dayjs(rec.next_followup_date).tz(IST).format("DD MMM YYYY, HH:mm")
                          : "—"}
                      </span>
                    </div>
                    {rec.product_model && (
                      <div>
                        <span className="text-gray-500">Model:</span>{" "}
                        <span className="font-medium">{rec.product_model}</span>
                      </div>
                    )}
                    {rec.contact && (
                      <div>
                        <span className="text-gray-500">Contact:</span>{" "}
                        <span className="font-medium">{rec.contact}</span>
                      </div>
                    )}
                    {rec.notes && (
                      <div className="sm:col-span-2">
                        <span className="text-gray-500">Notes:</span>{" "}
                        <span className="font-medium">{rec.notes}</span>
                      </div>
                    )}
                    {rec.image && (
                      <div className="sm:col-span-2 mt-1">
                        <a
                          href={rec.image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          📷 View Image
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
