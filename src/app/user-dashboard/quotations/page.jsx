import Link from "next/link";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import UserQuotationsListClient from "./UserQuotationsListClient";

export const dynamic = "force-dynamic";

// FETCH QUOTATIONS
async function getQuotations(username, role, { search, date_from, date_to, customer_id }) {
  const conn = await getDbConnection();

  let query = "";
  let values = [];

  // ---------------------------------------------------------
  // ⭐ SERVICE HEAD → SEE ALL SERVICE TEAM QUOTATIONS
  // ---------------------------------------------------------
  if (role === "SERVICE HEAD") {
    query = `
      SELECT 
        qr.quote_number,
        qr.quote_date,
        qr.company_name,
        qr.grand_total,
        qr.emp_name AS created_by,
        c.first_name AS client_name,
        c.email,
        c.phone
      FROM quotations_records qr
      LEFT JOIN customers c ON c.customer_id = qr.customer_id
      WHERE qr.emp_name NOT IN (
        SELECT username FROM rep_list
        WHERE userRole LIKE '%SALES%'
      )
    `;
  }

  // ---------------------------------------------------------
  // ⭐ NORMAL USERS (Sales, Service engineer, etc.)
  // ---------------------------------------------------------
  else {
    query = `
      SELECT 
        qr.quote_number,
        qr.quote_date,
        qr.company_name,
        qr.grand_total,
        qr.emp_name AS created_by,
        c.first_name AS client_name,
        c.email,
        c.phone
      FROM quotations_records qr
      JOIN customers c ON c.customer_id = qr.customer_id
      WHERE (
          c.sales_representative = ?
          OR c.lead_source = ?
          OR qr.emp_name = ?
      )
    `;
    values.push(username, username, username);
  }

  // ---------------------------------------------------------
  // ⭐ SEARCH FILTER
  // ---------------------------------------------------------
  if (search) {
    query += `
      AND (
        qr.quote_number LIKE ?
        OR qr.company_name LIKE ?
        OR c.first_name LIKE ?
        OR c.email LIKE ?
        OR c.phone LIKE ?
        OR qr.emp_name LIKE ?
      )
    `;
    const like = `%${search}%`;
    values.push(like, like, like, like, like, like);
  }

  // ---------------------------------------------------------
  // ⭐ DATE FILTER (full range, or open-ended if only one date)
  // ---------------------------------------------------------
  if (date_from && date_to) {
    query += ` AND qr.quote_date BETWEEN ? AND ? `;
    values.push(date_from, date_to);
  } else if (date_from) {
    query += ` AND qr.quote_date >= ? `;
    values.push(date_from);
  } else if (date_to) {
    query += ` AND qr.quote_date <= ? `;
    values.push(date_to);
  }

  if (customer_id) {
    query += ` AND qr.customer_id = ? `;
    values.push(customer_id);
  }

  // ---------------------------------------------------------
  // ⭐ ORDER BY LATEST FIRST
  // ---------------------------------------------------------
  query += ` ORDER BY qr.quote_date DESC `;

  const [rows] = await conn.execute(query, values);
  return rows;
}

export default async function QuotationPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload) return null;

  const username = payload.username;
  const role = payload.role;

  const params = await searchParams;

  const filters = {
    search: params?.search ?? "",
    date_from: params?.date_from ?? "",
    date_to: params?.date_to ?? "",
    customer_id: params?.customer_id ? String(params.customer_id).trim() : "",
  };

  const quotations = await getQuotations(username, role, filters);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Quotation Management
        </h1>
        <Link
          href={
            filters.customer_id
              ? `/user-dashboard/quotations/new?customerId=${encodeURIComponent(filters.customer_id)}`
              : "/user-dashboard/quotations/new"
          }
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-center"
        >
          + New Quotation
        </Link>
      </div>

      <form
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 bg-white p-3 rounded shadow"
        method="get"
      >
        {filters.customer_id ? (
          <input
            type="hidden"
            name="customer_id"
            value={filters.customer_id}
          />
        ) : null}
        <input
          type="text"
          name="search"
          placeholder="Search ID, client, email, phone, created by"
          defaultValue={filters.search}
          className="p-2 border rounded"
        />
        <input
          type="date"
          name="date_from"
          defaultValue={filters.date_from}
          className="p-2 border rounded"
        />
        <input
          type="date"
          name="date_to"
          defaultValue={filters.date_to}
          className="p-2 border rounded"
        />
        <button type="submit" className="p-2 bg-green-600 text-white rounded">
          Apply
        </button>
        <a
          href={
            filters.customer_id
              ? `?customer_id=${encodeURIComponent(filters.customer_id)}`
              : "?"
          }
          className="p-2 border rounded text-center"
        >
          Reset
        </a>
      </form>

      <UserQuotationsListClient quotations={quotations} />
    </div>
  );
}
