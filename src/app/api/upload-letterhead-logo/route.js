import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { canEditDocumentLetterhead } from "@/lib/documentFromCompany";
import { uploadImage } from "../mediahandler";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (!canEditDocumentLetterhead(payload)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image must be under 2 MB" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let url;
    try {
      url = await uploadImage(
        {
          data: buffer,
          name: file.name,
          mimetype: file.type || "application/octet-stream",
        },
        "letterhead",
      );
    } catch (uploadErr) {
      console.error("[Upload letterhead logo] uploadImage:", uploadErr);
      return NextResponse.json(
        { success: false, error: "Could not process image. Try PNG or JPG under 2 MB." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("[Upload letterhead logo]", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 },
    );
  }
}
