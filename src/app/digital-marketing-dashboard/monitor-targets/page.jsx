// src/app/targets/page.jsx

import TargetTable from "@/components/targets/TargetTable";

export default function TargetsPage() {
  return (
    <div className="container mx-auto p-4 sm:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        Assigned Targets
      </h1>
      <TargetTable />
    </div>
  );
}
