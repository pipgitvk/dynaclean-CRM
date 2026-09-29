import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { ensureServiceReportStepsTable } from "@/lib/ensureServiceReportStepsTable";
import {
  isServiceVideoCloudinaryEnabled,
  uploadServiceReportVideo,
} from "@/lib/uploadServiceReportVideo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VIDEO_STEPS = ["video_360", "video_problem", "video_damaged", "video_completion"];
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const EXT_BY_MIME = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/3gpp": ".3gp",
  "video/3gpp2": ".3gp",
  "video/x-matroska": ".mkv",
  "video/x-msvideo": ".avi",
  "video/avi": ".avi",
};

function videoExtension(file) {
  const fromName = String(file?.name || "").match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
  const allowed = new Set([".mp4", ".mov", ".webm", ".3gp", ".mkv", ".m4v", ".avi"]);
  if (fromName && allowed.has(fromName)) return fromName;
  if (EXT_BY_MIME[file?.type]) return EXT_BY_MIME[file.type];
  if (String(file?.type || "").startsWith("video/")) return ".mp4";
  return null;
}

async function loadService(conn, serviceId) {
  const [[row]] = await conn.execute(
    `SELECT
        sr.service_id,
        sr.status,
        sr.complaint_summary,
        sr.serial_number,
        sr.service_type,
        sr.assigned_to,
        s.video_360,
        s.video_problem,
        s.video_damaged,
        s.video_completion,
        s.work_started_at,
        s.work_completed_at
     FROM service_records sr
     LEFT JOIN service_report_steps s ON s.service_id = sr.service_id
     WHERE sr.service_id = ?`,
    [serviceId],
  );
  return row || null;
}

function payloadFromRow(row) {
  return {
    service: {
      service_id: row.service_id,
      status: row.status,
      complaint_summary: row.complaint_summary,
      serial_number: row.serial_number,
      service_type: row.service_type,
      assigned_to: row.assigned_to,
    },
    steps: {
      video_360: row.video_360 || null,
      video_problem: row.video_problem || null,
      video_damaged: row.video_damaged || null,
      video_completion: row.video_completion || null,
      work_started_at: row.work_started_at || null,
      work_completed_at: row.work_completed_at || null,
    },
  };
}

function missingBefore(steps, action) {
  if (action === "video_problem" && !steps.video_360) return "Upload the 360° video first.";
  if (action === "video_damaged" && !steps.video_problem) return "Upload the problem video first.";
  if (action === "work_start" && !steps.video_damaged) return "Upload the damaged parts video first.";
  if (action === "work_complete" && !steps.work_started_at) return "Start the work first.";
  if (action === "video_completion" && !steps.work_completed_at) return "Mark the work completed first.";
  return null;
}

export async function GET(_request, context) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { service_id: serviceId } = await context.params;
  if (!/^\d+$/.test(String(serviceId || ""))) {
    return NextResponse.json({ message: "Invalid service ID" }, { status: 400 });
  }

  try {
    const conn = await ensureServiceReportStepsTable();
    const row = await loadService(conn, serviceId);
    if (!row) {
      return NextResponse.json({ message: "Service not found" }, { status: 404 });
    }
    return NextResponse.json(payloadFromRow(row));
  } catch (error) {
    console.error("[service-report-steps GET]", error);
    return NextResponse.json({ message: "Failed to load service steps" }, { status: 500 });
  }
}

export async function POST(request, context) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { service_id: serviceId } = await context.params;
  if (!/^\d+$/.test(String(serviceId || ""))) {
    return NextResponse.json({ message: "Invalid service ID" }, { status: 400 });
  }

  try {
    const conn = await ensureServiceReportStepsTable();
    const existing = await loadService(conn, serviceId);
    if (!existing) {
      return NextResponse.json({ message: "Service not found" }, { status: 404 });
    }
    if (String(existing.service_type || "").trim().toUpperCase() !== "COMPLAINT") {
      return NextResponse.json(
        { message: "Video steps are only for complaint services." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const action = String(formData.get("action") || "");
    const current = payloadFromRow(existing).steps;
    const blocked = missingBefore(current, action);
    if (blocked) {
      return NextResponse.json({ message: blocked }, { status: 400 });
    }

    if (VIDEO_STEPS.includes(action)) {
      const file = formData.get("file");
      if (!file || typeof file === "string" || file.size <= 0) {
        return NextResponse.json({ message: "Choose a video to upload." }, { status: 400 });
      }
      if (file.size > MAX_VIDEO_BYTES) {
        return NextResponse.json({ message: "Video is too large. Maximum size is 200 MB." }, { status: 400 });
      }
      const ext = videoExtension(file);
      if (!ext) {
        return NextResponse.json({ message: "Upload a video file (mp4, mov, webm, or 3gp)." }, { status: 400 });
      }
      if (!isServiceVideoCloudinaryEnabled()) {
        return NextResponse.json({ message: "Cloudinary is not configured." }, { status: 500 });
      }

      const videoUrl = await uploadServiceReportVideo(
        Buffer.from(await file.arrayBuffer()),
        serviceId,
        action,
      );

      await conn.execute(
        `INSERT INTO service_report_steps (service_id, ${action})
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE ${action} = ?`,
        [serviceId, videoUrl, videoUrl],
      );
    } else if (action === "work_start") {
      await conn.execute(
        `INSERT INTO service_report_steps (service_id, work_started_at)
         VALUES (?, NOW())
         ON DUPLICATE KEY UPDATE work_started_at = IFNULL(work_started_at, NOW())`,
        [serviceId],
      );
      if (String(existing.status || "").toUpperCase() !== "COMPLETED") {
        await conn.execute(
          `UPDATE service_records SET status = 'WORKED' WHERE service_id = ?`,
          [serviceId],
        );
      }
    } else if (action === "work_complete") {
      await conn.execute(
        `INSERT INTO service_report_steps (service_id, work_completed_at)
         VALUES (?, NOW())
         ON DUPLICATE KEY UPDATE work_completed_at = IFNULL(work_completed_at, NOW())`,
        [serviceId],
      );
    } else {
      return NextResponse.json({ message: "Unknown step." }, { status: 400 });
    }

    const row = await loadService(conn, serviceId);
    return NextResponse.json(payloadFromRow(row));
  } catch (error) {
    console.error("[service-report-steps POST]", error);
    return NextResponse.json({ message: "Could not save this step." }, { status: 500 });
  }
}
