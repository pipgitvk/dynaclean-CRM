import { CalendarDays, Phone, Eye, PenLine, User } from "lucide-react";

const TaskCard = ({
  customerId,
  name,
  contact,
  products_interest,
  stage,
  dueDate,
  notes,
  status,
  bgColor,
}) => {
  return (
    <div
      className="flex flex-col justify-between rounded-2xl shadow-md min-w-[250px] max-w-[300px] p-5 text-white border border-gray-200 hover:shadow-lg transition duration-300 bg-white"
      style={{ backgroundColor: bgColor }}
    >
      <div>
        {/* Name */}
        <h3 className="text-s  mb-1 line-clamp-1 text-white">{name}</h3>

        {/* Contact */}
        <div className="flex items-center gap-2 text-xs text-white-600 mb-3">
          <Phone size={14} className="text-gray-200" />
          <span>{contact}</span>
        </div>

        {/* Notes */}
        <p className="text-sm text-white mb-4 line-clamp-3">
          {notes || "No notes"}
        </p>

        {/* Products Interested */}
        <p className="text-sm text-white mb-4 line-clamp-3">
          {products_interest || "products not showing"}
        </p>

        {/* Meta Info Section */}
        <div className="space-y-2 text-xs text-white font-medium">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-gray-200" />
            <span>Scheduled: {dueDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>Status: {status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Stage: {stage || "-"}</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-between items-center gap-2 mt-6">
        <a
          href={`/user-dashboard/tl-customers/${customerId}`}
          className="flex items-center justify-center gap-1 text-s font-semibold text-gray-600 px-3 py-1.5 rounded-lg transition"
        >
          View
        </a>
        <a
          href={`/user-dashboard/tl-customers/${customerId}/followup`}
          className="flex items-center justify-center gap-1 text-s font-semibold text-gray-600 px-3 py-1.5 rounded-lg transition"
        >
          Follow
        </a>
      </div>
    </div>
  );
};

export default TaskCard;
