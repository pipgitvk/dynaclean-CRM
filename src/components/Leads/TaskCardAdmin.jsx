import { CalendarDays, Phone, Eye, PenLine, User } from "lucide-react";

const TaskCard = ({
  customerId,
  name,
  contact,
  dueDate,
  notes,
  status,
  bgColor,
}) => {
  return (
    <div
      className="flex flex-col justify-between rounded-2xl shadow-md min-w-[280px] max-w-[320px] p-5 text-gray-800 border border-gray-200 hover:shadow-lg transition duration-300 bg-white"
      style={{ backgroundColor: bgColor }}
    >
      <div>
        {/* Name */}
        <h3 className="text-xl font-semibold mb-1 line-clamp-1">{name}</h3>

        {/* Contact */}
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
          <Phone size={14} className="text-gray-500" />
          <span>{contact}</span>
        </div>

        {/* Notes */}
        <p className="text-sm text-gray-700 mb-4 line-clamp-3">
          {notes || "No notes"}
        </p>

        {/* Meta Info Section */}
        <div className="space-y-2 text-xs text-gray-700 font-medium">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-gray-500" />
            <span>Scheduled: {dueDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>Status: {status}</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-between items-center gap-2 mt-6">
        <a
          href={`/admin-dashboard/view-customer/${customerId}`}
          className="flex items-center justify-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition"
        >
          View
        </a>
        <a
          href={`/admin-dashboard/view-customer/${customerId}/follow-up`}
          className="flex items-center justify-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition"
        >
          Follow
        </a>
      </div>
    </div>
  );
};

export default TaskCard;
