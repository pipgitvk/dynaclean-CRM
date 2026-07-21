import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn = await getDbConnection();

  try {
    // Get pre-booked quantities grouped by product_name
    const [rows] = await conn.execute(`
      SELECT
        product_name,
        SUM(quantity) as pre_booked_quantity
      FROM pre_booking
      GROUP BY product_name
    `);

    console.log("Pre-booking summary fetched successfully:", rows.length, "products with pre-bookings");

    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching pre-booking summary:", error);
    return Response.json({ error: "Failed to fetch pre-booking summary" }, { status: 500 });
  }
}
