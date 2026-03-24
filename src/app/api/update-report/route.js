// src/app/api/update-report/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const serviceId = formData.get("serviceId");
    const status = formData.get("status");
    const image = formData.get("image");

    if (!serviceId || !status || !image) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let dbColumnName;
    let cloudinaryFolder;

    if (status === "COMPLETED") {
      dbColumnName = "final_report_path";
      cloudinaryFolder = "service_reports/completed";
    } else if (status === "PENDING FOR SPARES") {
      dbColumnName = "report_path";
      cloudinaryFolder = "service_reports/pending_spares";
    } else {
      return NextResponse.json({ error: "Invalid status provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const dataUri = `data:${image.type};base64,${base64}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: cloudinaryFolder,
      public_id: `${serviceId}_${Date.now()}`,
      resource_type: "auto",
    });

    const publicPath = uploadResult.secure_url;

    const conn = await getDbConnection();

    let sql = `UPDATE service_records SET ${dbColumnName} = ?, status = ?`;
    const params = [publicPath, status];

    if (status === "COMPLETED") {
      sql += `, completed_date = CURDATE()`;
    }

    sql += ` WHERE service_id = ?`;
    params.push(serviceId);

    await conn.execute(sql, params);

    return NextResponse.json({ message: "Report updated successfully", publicPath }, { status: 200 });
  } catch (error) {
    console.error("Booking Upload Error:", error);
    return NextResponse.json({ error: "Failed to upload report." }, { status: 500 });
  }
}