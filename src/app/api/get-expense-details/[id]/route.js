import { getDbConnection } from "@/lib/db";

export async function GET(req, { params }) {
  const { id } = await params;
  const conn = await getDbConnection();

  const result = await conn.query(
    `SELECT username, person_name, attachments, approved_amount, approval_status, payment_date, Notes,TravelDate,FromLocation,Tolocation,distance,person_contact,ConveyanceMode,TicketCost,HotelCost,MealsCost,OtherExpenses,description FROM expenses WHERE ID = ?`,
    [id],
  );

  console.log("Expense details fetched for ID:", result[0]);

  return new Response(JSON.stringify(result[0]));
}
