import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  try {
    const { id, demo_date_time, status, description, postpone_date } = await req.json();

    if (!id || !demo_date_time || !status || !description) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
      });
    }

    const conn = await getDbConnection();
    let sql = "";
    let params = [];
    const now = new Date();

    if (status === "Complete") {
      sql = `
        UPDATE demoregistration 
        SET 
          demo_status = 'Complete', 
          demo_completion_date = ?, 
          completion_description = ?,
          cancel_description = NULL,
          postponed_date = NULL,
          postponed_description = NULL
        WHERE customer_id = ? AND demo_date_time = ?
      `;
      params = [now, description, id, demo_date_time];
    } else if (status === "Postponed") {
      if (!postpone_date) {
        return new Response(JSON.stringify({ error: "Postpone date is required" }), { status: 400 });
      }
      sql = `
        UPDATE demoregistration 
        SET 
          demo_status = 'Postponed', 
          postponed_date = ?, 
          postponed_description = ?,
          completion_description = NULL,
          cancel_description = NULL,
          demo_completion_date = NULL
        WHERE customer_id = ? AND demo_date_time = ?
      `;
      params = [postpone_date, description, id, demo_date_time];
    } else if (status === "Canceled") {
      sql = `
        UPDATE demoregistration 
        SET 
          demo_status = 'Canceled', 
          cancel_description = ?,
          completion_description = NULL,
          postponed_date = NULL,
          postponed_description = NULL,
          demo_completion_date = NULL
        WHERE customer_id = ? AND demo_date_time = ?
      `;
      params = [description, id, demo_date_time];
    } else {
      return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400 });
    }

    const [result] = await conn.execute(sql, params);
    console.log("🛠 Affected rows: ", result.affectedRows);

    if (result.affectedRows === 0) {
        return new Response(JSON.stringify({ error: "No matching record found" }), {
          status: 404,
        });
    }

    // Fetch the updated row to send back to the client
    const [updatedRow] = await conn.execute(
        "SELECT * FROM demoregistration WHERE customer_id = ? AND demo_date_time = ?",
        [id, demo_date_time]
    );

    // await conn.end();

    return new Response(
        JSON.stringify({ updatedItem: updatedRow[0] }),
        { status: 200 }
    );
  } catch (err) {
    console.error("❌ Status update error:", err);
    return new Response(JSON.stringify({ error: "Server Error" }), {
      status: 500,
    });
  }
}