// src/app/components/targets/TargetTable.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import { Search, Eye, Edit } from "lucide-react";
import TargetCompletionModal from "./TargetCompletionModal";
import EditTargetModal from "./EditTargetModal";
import { useUser } from "@/context/UserContext";

const TargetTable = () => {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const router = useRouter(); // Initialize the router
  const { user } = useUser();
  // console.log("Logged in user:", user?.userRole);

  // Add this helper at the top of your component file
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const openCompletionModal = (target) => {
    setSelectedTarget(target);
    setIsCompletionModalOpen(true);
  };

  const closeCompletionModal = () => {
    setIsCompletionModalOpen(false);
    setSelectedTarget(null);
  };

  const openEditModal = (target) => {
    setSelectedTarget(target);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedTarget(null);
  };

  const handleEditSuccess = () => {
    // Refresh targets after successful edit
    fetchTargets();
  };

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/monitor-target");
      if (!response.ok) {
        throw new Error("Failed to fetch targets");
      }
      const data = await response.json();
      setTargets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTargets = targets.filter((target) =>
    target.username.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return <div className="text-center py-10">Loading targets...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        {/* Back Button */}
        <button
          onClick={() => router.back()} // Use router.back() for navigation
          className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors duration-200"
        >
          &larr; Back
        </button>

        <div className="relative w-full max-w-sm ml-auto">
          <input
            type="text"
            placeholder="Search by username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-gray-600 transition-colors"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase text-sm">
              <th className="py-3 px-6 text-center">Username</th>
              <th className="py-3 px-6 text-center">Target</th>
              <th className="py-3 px-6 text-center">Start Date</th>
              <th className="py-3 px-6 text-center">End Date</th>
              <th className="py-3 px-6 text-center">Assigned By</th>
              <th className="py-3 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {filteredTargets.length > 0 ? (
              filteredTargets.map((target, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="py-3 px-6 text-center">{target.username}</td>
                  <td className="py-3 px-6 text-center">{target.target}</td>
                  <td className="py-3 px-6 text-center">
                    {formatDate(target.target_start_date)}
                  </td>
                  <td className="py-3 px-6 text-center">
                    {formatDate(target.target_end_date)}
                  </td>
                  <td className="py-3 px-6 text-center">{target.created_by}</td>
                  <td className="py-3 px-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openCompletionModal(target)}
                        className="inline-flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
                        title="View Completion"
                      >
                        <Eye size={16} />
                        View
                      </button>
                      {user?.userRole === "SUPERADMIN" && (
                        <button
                          onClick={() => openEditModal(target)}
                          className="inline-flex items-center gap-1 bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors duration-200"
                          title="Edit Target"
                        >
                          <Edit size={16} />
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="py-4 text-center text-gray-500">
                  No targets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-4">
        {filteredTargets.length > 0 ? (
          filteredTargets.map((target, index) => (
            <div
              key={index}
              className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="font-bold text-lg mb-2">{target.username}</div>
              <div className="text-sm text-gray-600">
                <p>
                  <strong>Target:</strong> {target.target}
                </p>
                <p>
                  <strong>Start Date:</strong>{" "}
                  {formatDate(target.target_start_date)}
                </p>
                <p>
                  <strong>End Date:</strong>{" "}
                  {formatDate(target.target_end_date)}
                </p>

                <p>
                  <strong>Assigned By:</strong> {target.created_by}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => openCompletionModal(target)}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
                >
                  <Eye size={16} />
                  View
                </button>
                {user?.userRole === "SUPERADMIN" && (
                  <button
                    onClick={() => openEditModal(target)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors duration-200"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                )}
                {/* <button
                  onClick={() => openEditModal(target)}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors duration-200"
                >
                  <Edit size={16} />
                  Edit
                </button> */}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500">
            No targets found.
          </div>
        )}
      </div>

      {/* Target Completion Modal */}
      <TargetCompletionModal
        isOpen={isCompletionModalOpen}
        onClose={closeCompletionModal}
        targetData={selectedTarget}
      />

      {/* Edit Target Modal */}
      <EditTargetModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        targetData={selectedTarget}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default TargetTable;
