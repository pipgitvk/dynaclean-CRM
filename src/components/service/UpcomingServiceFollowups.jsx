// components/service/UpcomingServiceFollowups.jsx
// Upcoming Enquiry — overdue follow-ups (next_followup_date in past, within last 30 days)
import { getDbConnection } from "@/lib/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { CalendarDays, Phone, PackageSearch, AlarmClock } from "lucide-react";
import Link from "next/link";

dayjs.extend(utc);
dayjs.extend(timezone);
const IST = "Asia/Kolkata";

function getCardColor(nextFollowupDate) {
  if (!nextFollowupDate) return { bg: "bg-gray-100", border: "border-gray-300", badge: "bg-gray-500", text: "text-gray-600", label: "No Date" };
  const hours = (new Date(nextFollowupDate).getTime() - Date.now()) / 3600000;
  if (hours < 0)   return { bg: "bg-red-50",    border: "border-red-300",    badge: "bg-red-500",    text: "text-red-700",    label: "Overdue"  };
  if (hours <= 24) return { bg: "bg-orange-50", border: "border-orange-300", badge: "bg-orange-500", text: "text-orange-700", label: "Due Soon" };
  if (hours <= 72) return { bg: "bg-yellow-50", border: "border-yellow-300", badge: "bg-yellow-500", text: "text-yellow-700", label: "Upcoming" };
  return              { bg: "bg-green-50",  border: "border-green-300",  badge: "bg-green-500",  text: "text-green-700",  label: "Scheduled" };
}

export default async function UpcomingServiceFollowups({ username, userRole }) {
  const connection = await getDbConnection();
  const role = (userRole || "").toUpperCase();
  const canViewAll = role === "SERVICE HEAD" || role === "SUPERADMIN" || role === "DIRECTOR";
  
  let rows;
  
  if (canViewAll) {
    [rows] = await connection.execute(
      `SELECT mf.*
       FROM machines_followup mf
       INNER JOIN (
         SELECT serial_number, MAX(id) AS max_id
         FROM machines_followup
         GROUP BY serial_number
       ) latest ON mf.serial_number = latest.serial_number AND mf.id = latest.max_id
       WHERE mf.next_followup_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND mf.next_followup_date <= NOW()
       ORDER BY mf.next_followup_date ASC
       LIMIT 60`
    );
  } else {
    [rows] = await connection.execute(
      `SELECT mf.*
       FROM machines_followup mf
       INNER JOIN (
         SELECT serial_number, MAX(id) AS max_id
         FROM machines_followup
         WHERE added_by = ?
         GROUP BY serial_number
       ) latest ON mf.serial_number = latest.serial_number AND mf.id = latest.max_id
       WHERE mf.next_followup_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND mf.next_followup_date <= NOW()
       ORDER BY mf.next_followup_date ASC
       LIMIT 60`,
      [username]
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700 flex items-center gap-2">
          <AlarmClock className="text-red-500" size={26} />
          Upcoming Enquiry ({rows.length})
        </h2>
        <Link href="/user-dashboard/service-followups">
          <button className="px-4 py-2 bg-red-500 hover:bg-red-700 text-white rounded-md transition text-sm">
            View All
          </button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm py-3">No pending enquiries.</p>
      ) : (
        <div className="w-full overflow-x-auto pb-3 hide-scrollbar">
          <div className="flex flex-row gap-4 flex-nowrap min-w-max">
            {rows.map((fu) => {
              const color = getCardColor(fu.next_followup_date);
              return (
                <div key={fu.id}
                  className={`w-[280px] flex-shrink-0 rounded-2xl border-2 p-4 shadow-sm hover:shadow-md transition duration-300 ${color.bg} ${color.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${color.badge}`}>{color.label}</span>
                    <span className="text-xs text-gray-400 font-medium">#{fu.id}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <PackageSearch size={15} className={color.text} />
                    <span className="text-sm font-bold text-gray-800 truncate">{fu.serial_number}</span>
                  </div>
                  {fu.product_model && <p className="text-xs text-gray-500 mb-2 ml-5 truncate">{fu.product_model}</p>}
                  {fu.contact && (
                    <div className="flex items-center gap-2 mb-2">
                      <Phone size={13} className="text-gray-400" />
                      <span className="text-xs text-gray-600 truncate">{fu.contact}</span>
                    </div>
                  )}
                  {fu.notes && <p className="text-xs text-gray-500 mb-2 line-clamp-2 italic">"{fu.notes}"</p>}
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={12} />
                      <span>Last: {dayjs(fu.followed_at).tz(IST).format("DD MMM YYYY, hh:mm A")}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-semibold ${color.text}`}>
                      <CalendarDays size={12} />
                      <span>Next: {fu.next_followup_date ? dayjs(fu.next_followup_date).tz(IST).format("DD MMM YYYY, hh:mm A") : "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
