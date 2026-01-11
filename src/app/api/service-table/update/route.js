import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDbConnection } from "@/lib/db";
import { randomUUID } from "crypto";

export async function POST(req) {
  try {
    const formData = await req.formData();

    const service_id = formData.get("service_id");
    const observation = formData.get("observation");
    const action_taken = formData.get("action_taken");
    const parts_replaced = formData.get("parts_replaced");
    const service_description = formData.get("service_description");
    const status = formData.get("status");

    const files = formData.getAll("images");
    const uploadDir = path.join(process.cwd(), "public", "attachments");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const savedPaths = [];

    for (const file of files) {
      if (!file || typeof file === "string") continue;

      const ext = path.extname(file.name);
      const filename = `${Date.now()}-${randomUUID()}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
      savedPaths.push(`/attachments/${filename}`);
    }

    const connection = await getDbConnection();
    await connection.execute(
      `UPDATE service_records SET observation = ?, action_taken = ?, parts_replaced = ?, service_description = ?, status = ?, attachments = ? WHERE service_id = ?`,
      [observation, action_taken, parts_replaced, service_description, status, savedPaths.join(","), service_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Service update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
