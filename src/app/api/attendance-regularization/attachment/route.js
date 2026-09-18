export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { readAttendanceRegularizationAttachment } from "@/lib/readAttendanceRegularizationAttachment";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("id");
    let attachmentUrl = searchParams.get("path") || searchParams.get("url") || "";

    if (requestId) {
      const conn = await getDbConnection();
      const [rows] = await conn.execute(
        `SELECT attachment_url FROM attendance_regularization_requests WHERE id = ? LIMIT 1`,
        [requestId],
      );
      if (!rows?.[0]?.attachment_url) {
        return NextResponse.json(
          { message: "Attachment not found for this request" },
          { status: 404 },
        );
      }
      attachmentUrl = rows[0].attachment_url;
    }

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
    console.error("attendance-regularization attachment GET:", error);
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
