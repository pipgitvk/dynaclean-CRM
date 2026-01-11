import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const service_id = searchParams.get("service_id");
  if (!service_id) {
    return NextResponse.json({ error: "service_id is required" }, { status: 400 });
  }

  const conn = await getDbConnection();
  try {
    const [serviceRows] = await conn.execute("SELECT * FROM service_records WHERE service_id = ?", [service_id]);
    if (!serviceRows.length) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    const service = serviceRows[0];
    const serial = service.serial_number;

    const [productRows] = await conn.execute("SELECT * FROM warranty_products WHERE serial_number = ?", [serial]);
        // await conn.end();

    return NextResponse.json({
      service,
      product: productRows[0] || null,
      attachments: service.attachments ? service.attachments.split(",") : [],
      completion_images: service.completion_images ? service.completion_images.split(",") : [],
      installation_report: service.installation_report || null,
    });
  } catch (err) {
    console.error(err);
        // await conn.end();
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
