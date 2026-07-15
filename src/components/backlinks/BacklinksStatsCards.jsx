"use client";

import { CheckCircle, Clock, Pause, AlertCircle } from "lucide-react";

const BacklinksStatsCards = ({ backlinks }) => {
  // Calculate stats based on backlinks data
  const calculateStats = () => {
    const total = backlinks.length;
    const pending = backlinks.filter((bl) => bl.status === "pending").length;
    const completed = backlinks.filter((bl) => bl.status === "completed").length;
    const inProgress = backlinks.filter((bl) => bl.status === "in_progress").length;
    const onHold = backlinks.filter((bl) => bl.status === "on_hold").length;

    return { total, pending, completed, inProgress, onHold };
  };

  const stats = calculateStats();

  const StatCard = ({ icon: Icon, label, value, color, bgColor, textColor }) => (
    <div className={`${bgColor} rounded-lg shadow-md p-6 flex items-start gap-4 border-l-4 ${color}`}>
      <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
        <Icon size={24} className={`${textColor}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Total Backlinks */}
      <StatCard
        icon={AlertCircle}
        label="Total Backlinks"
        value={stats.total}
        color="border-blue-500"
        bgColor="bg-blue-50"
        textColor="text-blue-600"
      />

      {/* Pending */}
      <StatCard
        icon={AlertCircle}
        label="Pending"
        value={stats.pending}
        color="border-yellow-500"
        bgColor="bg-yellow-50"
        textColor="text-yellow-600"
      />

      {/* In Progress */}
      <StatCard
        icon={Clock}
        label="In Progress"
        value={stats.inProgress}
        color="border-blue-600"
        bgColor="bg-blue-50"
        textColor="text-blue-600"
      />

      {/* Completed */}
      <StatCard
        icon={CheckCircle}
        label="Completed"
        value={stats.completed}
        color="border-green-500"
        bgColor="bg-green-50"
        textColor="text-green-600"
      />

      {/* On Hold */}
      <StatCard
        icon={Pause}
        label="On Hold"
        value={stats.onHold}
        color="border-orange-500"
        bgColor="bg-orange-50"
        textColor="text-orange-600"
      />
    </div>
  );
};

export default BacklinksStatsCards;
