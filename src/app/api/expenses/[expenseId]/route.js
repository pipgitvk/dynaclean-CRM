import { getDbConnection } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function PUT(req, { params }) {
  try {
    const { expenseId } = params;
    const formData = await req.formData();

    // Extract form fields
    const TravelDate = formData.get("TravelDate");
    const FromLocation = formData.get("FromLocation");
    const Tolocation = formData.get("Tolocation");
    const distance = formData.get("distance");
    const person_name = formData.get("person_name");
    const person_contact = formData.get("person_contact");
    const ConveyanceMode = formData.get("ConveyanceMode");
    const TicketCost = formData.get("TicketCost");
    const HotelCost = formData.get("HotelCost");
    const MealsCost = formData.get("MealsCost");
    const OtherExpenses = formData.get("OtherExpenses");
    const description = formData.get("description");
    const existingAttachments = formData.get("existingAttachments");

    // Handle new file uploads
    const newAttachments = [];
    const attachments = formData.getAll("attachments");
    
    for (const file of attachments) {
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Create unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${file.name}`;
        const path = join(process.cwd(), "public", "attachments", filename);
        
        // Ensure directory exists
        await mkdir(join(process.cwd(), "public", "attachments"), { recursive: true });
        
        // Write file
        await writeFile(path, buffer);
        newAttachments.push(`/attachments/${filename}`);
      }
    }

    // Combine existing and new attachments
    const allAttachments = [];
    if (existingAttachments) {
      allAttachments.push(...existingAttachments.split(", ").filter(Boolean));
    }
    allAttachments.push(...newAttachments);
    const finalAttachments = allAttachments.join(", ");

    const conn = await getDbConnection();
    const sql = `UPDATE expenses SET
      TravelDate = ?,
      FromLocation = ?,
      Tolocation = ?,
      distance = ?,
      person_name = ?,
      person_contact = ?,
      ConveyanceMode = ?,
      TicketCost = ?,
      HotelCost = ?,
      MealsCost = ?,
      OtherExpenses = ?,
      description = ?,
      attachments = ?
    WHERE ID = ?`;

    const values = [
      TravelDate || null,
      FromLocation || null,
      Tolocation || null,
      Number(distance || 0),
      person_name || null,
      person_contact || null,
      ConveyanceMode || null,
      Number(TicketCost || 0),
      Number(HotelCost || 0),
      Number(MealsCost || 0),
      Number(OtherExpenses || 0),
      description || null,
      finalAttachments || null,
      expenseId,
    ];

    const [result] = await conn.execute(sql, values);
    // await conn.end();

    return new Response(JSON.stringify({ ok: true, affectedRows: result.affectedRows }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


