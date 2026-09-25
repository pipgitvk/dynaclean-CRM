import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { uploadServiceCompletionImage } from "@/lib/uploadServiceCompletionImage";

export const dynamic = "force-dynamic";

const mergeList = (existing, newList) =>
  (existing ? String(existing).split(",") : [])
    .concat(newList)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",");

export async function POST(request, context) {
  try {
    const { service_id: serviceId } = await context.params;

    if (!serviceId) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const type = String(formData.get("type") || "").toLowerCase();
    const files = formData.getAll("images");

    if (type !== "pre" && type !== "post") {
      return NextResponse.json(
        { error: "Invalid image type. Use pre or post." },
        { status: 400 }
      );
    }

    if (!files.length) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    const savedFiles = [];
    for (const file of files) {
      const url = await uploadServiceCompletionImage(file, serviceId);
      if (url) savedFiles.push(url);
    }

    if (!savedFiles.length) {
      return NextResponse.json(
        { error: "No valid images uploaded" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [[existingRecord]] = await conn.execute(
      `SELECT pre_completion, after_completion FROM service_records WHERE service_id = ?`,
      [serviceId]
    );

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Service record not found" },
        { status: 404 }
      );
    }

    const column = type === "pre" ? "pre_completion" : "after_completion";
    const merged = mergeList(existingRecord[column], savedFiles);

    await conn.execute(
      `UPDATE service_records SET ${column} = ? WHERE service_id = ?`,
      [merged, serviceId]
    );

    const preCompletion =
      type === "pre" ? merged : existingRecord.pre_completion || "";
    const afterCompletion =
      type === "post" ? merged : existingRecord.after_completion || "";

    return NextResponse.json({
      status: "success",
      pre_completion: preCompletion,
      after_completion: afterCompletion,
    });
  } catch (error) {
    console.error("Error uploading completion images:", error);
    return NextResponse.json(
      { error: "Failed to upload images" },
      { status: 500 }
    );
  }
}
