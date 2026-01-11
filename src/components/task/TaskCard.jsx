import { CalendarDays, User, ClipboardList, Eye, PenLine } from "lucide-react";

const TaskCard = ({
  title,
  description,
  dueDate,
  bgColor,
  assignedBy,
  assignDate,
  status,
  taskId,
}) => {
  return (
    <div
      className="flex flex-col justify-between rounded-2xl shadow-md min-w-[250px] max-w-[320px] p-5 text-gray-700 border border-gray-200 hover:shadow-lg transition duration-300 bg-white "
      style={{ backgroundColor: bgColor }}
    >
      <div>
        {/* Task Name */}
        <h3 className="text-xl font-semibold mb-1 line-clamp-1">{title}</h3>

        {/* Assigned By */}
        <div className="flex items-center gap-2 text-xs text-gray-700 mb-3">
          <User size={14} className="text-white" />
          <span className="font-medium">Assigned by:</span>
          <span className="truncate">{assignedBy}</span>
        </div>

        {/* Notes/Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{description}</p>

        {/* Meta Info Section */}
        <div className="space-y-2 text-xs text-gray-600 font-medium">
          <div className="flex items-center gap-2">
            <ClipboardList size={14} className="text-white" />
            <span>Assigned on: {assignDate}</span>
          </div>

          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-white" />
            <span>Due: {dueDate}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>Status: {status}</span>
          </div>
        </div>
      </div>

      {/* Buttons pinned to bottom */}
      <div className="flex justify-between items-center gap-2 mt-6">
        <a
          href={`/user-dashboard/view-task/${taskId}`}
          className="flex items-center justify-center gap-1 text-s font-semibold text-gray-600  px-3 py-1.5 rounded-lg transition"
        >
          View
        </a>
        <a
          href={`/user-dashboard/followup_task/${taskId}`}
          className="flex items-center justify-center gap-1 text-s font-semibold text-gray-600  px-3 py-1.5 rounded-lg transition"
        >
          Follow
        </a>
      </div>
    </div>
  );
};

export default TaskCard;
