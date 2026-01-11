// components/SummaryBox.jsx
import { ArrowRight } from "lucide-react";

export default function SummaryBox({ title, count, onClick, isLoading }) {
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 animate-pulse cursor-wait">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-2"></div>
        <div className="h-12 bg-gray-200 rounded w-1/4"></div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:bg-gray-50 transition-all duration-300 cursor-pointer flex flex-col justify-between"
    >
      <div>
        <h4 className="text-lg font-semibold text-gray-600 mb-2">{title}</h4>
        <span className="text-4xl font-extrabold text-blue-600">{count}</span>
      </div>
      <div className="mt-4 flex items-center text-blue-500 font-medium">
        View Records
        <ArrowRight
          size={16}
          className="ml-2 transition-transform group-hover:translate-x-1"
        />
      </div>
    </div>
  );
}
