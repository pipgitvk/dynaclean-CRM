export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { readAttendanceRegularizationAttachment } from "@/lib/readAttendanceRegularizationAttachment";

export async function GET(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const segments = params?.path;
    const pathParts = Array.isArray(segments)
      ? segments
      : segments
        ? [segments]
        : [];

    if (!pathParts.length) {
      return NextResponse.json({ message: "Missing file path" }, { status: 400 });
    }

    const attachmentUrl = `/attendance_regularization/${pathParts
      .map((part) => decodeURIComponent(String(part)))
      .join("/")}`;

    const file = await readAttendanceRegularizationAttachment(attachmentUrl);
    if (!file) {
      return NextResponse.json({ message: "Attachment not found" }, { status: 404 });
    }

    return new Response(file.buffer, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("attendance_regularization legacy GET:", error);
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
