import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const STATE_CODE_TO_NAME = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  10: "Bihar",
  11: "Sikkim",
  12: "Arunachal Pradesh",
  13: "Nagaland",
  14: "Manipur",
  15: "Mizoram",
  16: "Tripura",
  17: "Meghalaya",
  18: "Assam",
  19: "West Bengal",
  20: "Jharkhand",
  21: "Odisha",
  22: "Chhattisgarh",
  23: "Madhya Pradesh",
  24: "Gujarat",
  25: "Daman & Diu",
  26: "Dadra & Nagar Haveli",
  27: "Maharashtra",
  28: "Andhra Pradesh (Old)",
  29: "Karnataka",
  30: "Goa",
  31: "Lakshadweep",
  32: "Kerala",
  33: "Tamil Nadu",
  34: "Puducherry",
  35: "Andaman & Nicobar Islands",
  36: "Telangana",
  37: "Andhra Pradesh",
  97: "Other Territory",
  99: "Centre Jurisdiction",
};

function isSalesRole(role) {
  return String(role || "").toUpperCase().includes("SALES");
}

function getStateFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  const name = STATE_CODE_TO_NAME[code];
  if (!name) return null;
  return `${name} (${code})`;
}

export async function PATCH(req, { params }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    ));
  } catch {
    return Response.json({ success: false, message: "Invalid token" }, { status: 401 });
  }

  if (!isSalesRole(payload.role)) {
    return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const { quoteId } = await params;
  if (!quoteId) {
    return Response.json({ success: false, message: "Missing quote number" }, { status: 400 });
  }

  const body = await req.json();
  const gstin_no = String(body.gstin_no ?? "").trim();
  const ship_to = String(body.ship_to ?? "").trim();

  if (!ship_to) {
    return Response.json(
      { success: false, message: "Ship to address is required" },
      { status: 400 },
    );
  }

  const conn = await getDbConnection();

  try {
    const [rows] = await conn.execute(
      "SELECT quote_number, emp_name FROM quotations_records WHERE quote_number = ?",
      [quoteId],
    );

    if (!rows.length) {
      return Response.json({ success: false, message: "Quotation not found" }, { status: 404 });
    }

    const quote = rows[0];
    if (quote.emp_name !== payload.username) {
      return Response.json(
        { success: false, message: "You can only edit your own quotations" },
        { status: 403 },
      );
    }

    const [orderRows] = await conn.execute(
      "SELECT order_id FROM neworder WHERE quote_number = ? LIMIT 1",
      [quoteId],
    );
    if (orderRows.length > 0) {
      return Response.json(
        { success: false, message: "Cannot edit quotation after order is created" },
        { status: 400 },
      );
    }

    const state_name = getStateFromGSTIN(gstin_no) || null;

    await conn.execute(
      `UPDATE quotations_records SET
        gstin = ?,
        ship_to = ?,
        state = COALESCE(?, state)
      WHERE quote_number = ?`,
      [gstin_no, ship_to, state_name, quoteId],
    );

    return Response.json({ success: true, message: "Quotation updated successfully" });
  } catch (err) {
    console.error("Sales quotation update error:", err);
    return Response.json(
      { success: false, message: "Server error: " + err.message },
      { status: 500 },
    );
  }
}
