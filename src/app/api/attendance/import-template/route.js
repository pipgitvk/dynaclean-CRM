import { NextResponse } from "next/server";

/** Inline so download works on production even when public/* is gitignored. */
const ATTENDANCE_IMPORT_TEMPLATE_CSV = `username,date,checkin_time,checkout_time,break_morning_start,break_morning_end,break_lunch_start,break_lunch_end,break_evening_start,break_evening_end,checkin_address,checkout_address
REPLACE_WITH_USERNAME_1,2026-04-21,09:18,18:22,10:50,11:05,13:02,13:32,15:55,16:10,Head Office,Head Office
REPLACE_WITH_USERNAME_2,2026-04-21,09:05,18:40,10:40,10:55,13:00,13:28,16:02,16:12,Head Office,Head Office
REPLACE_WITH_USERNAME_3,2026-04-21,09:28,18:15,11:00,11:15,13:08,13:38,16:05,16:18,Warehouse,Warehouse
REPLACE_WITH_USERNAME_1,2026-04-22,09:12,18:05,10:45,11:00,13:05,13:35,16:00,16:14,Client Site,Client Site
REPLACE_WITH_USERNAME_2,2026-04-22,09:20,18:30,10:42,10:58,13:02,13:30,16:05,16:15,Head Office,Head Office
REPLACE_WITH_USERNAME_1,2026-04-23,09:05,17:55,10:35,10:48,12:55,13:25,15:48,16:00,Head Office,Head Office
REPLACE_WITH_USERNAME_2,2026-04-23,09:30,18:10,11:00,11:12,13:08,13:35,16:02,16:18,Warehouse,Warehouse
REPLACE_WITH_USERNAME_3,2026-04-23,09:15,18:22,10:50,11:05,13:00,13:28,15:55,16:08,Warehouse,Warehouse
`;

/**
 * GET — sample CSV for HR bulk attendance import (same columns as /api/empcrm/attendance/import).
 */
export async function GET() {
  return new NextResponse(ATTENDANCE_IMPORT_TEMPLATE_CSV, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="attendance_import_template.csv"',
      "Cache-Control": "public, max-age=86400",
    },
  });
}
