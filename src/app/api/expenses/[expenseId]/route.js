import { getDbConnection } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function PUT(req, { params }) {
  try {
    const { expenseId } = await params;
    console.log(`[expense-edit] PUT /api/expenses/${expenseId} - update expense`);
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

    const newAttachments = [];
    const attachments = formData.getAll("attachments");
    const uploadDir = join(process.cwd(), "public", "attachments");
    console.log(`[expense-edit] UPLOAD_DIR=${uploadDir} newFilesCount=${attachments?.length || 0}`);

    for (const file of attachments) {
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const timestamp = Date.now();
        const filename = `${timestamp}-${file.name}`;
        const filePath = join(uploadDir, filename);

        await mkdir(uploadDir, { recursive: true });
        await writeFile(filePath, buffer);
        const publicPath = `/attachments/${filename}`;
        newAttachments.push(publicPath);
        console.log(`[expense-edit] SAVED file="${file.name}" -> ${filePath} (public: ${publicPath})`);
      }
    }

    // Combine existing and new attachments
    const allAttachments = [];
    if (existingAttachments) {
      allAttachments.push(...existingAttachments.split(", ").filter(Boolean));
    }
    allAttachments.push(...newAttachments);
    const finalAttachments = allAttachments.join(", ");
    console.log(`[expense-edit] finalAttachments="${finalAttachments}"`);

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

    console.log(`[expense-edit] SUCCESS expenseId=${expenseId} affectedRows=${result.affectedRows}`);
    return new Response(JSON.stringify({ ok: true, affectedRows: result.affectedRows }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[expense-edit] ERROR expenseId=${expenseId}:`, e?.message || e);
    console.error("[expense-edit] ERROR stack:", e?.stack);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


