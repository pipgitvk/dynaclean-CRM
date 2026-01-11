"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Check, X, Eye, Search, Filter } from "lucide-react";

const QAApprovalPage = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending"); // 'all', 'pending', 'approved'
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      let url = `/api/qa?filter=${filter}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error("Failed to fetch questions");
      
      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (err) {
      toast.error(err.message);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [filter]);

  const handleApprove = async (id) => {
    try {
      const response = await fetch("/api/qa/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error("Failed to approve question");
      
      toast.success("Question approved successfully");
      fetchQuestions();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReject = async (id) => {
    if (!confirm("Are you sure you want to reject this question?")) return;

    try {
      const response = await fetch("/api/qa/approve", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error("Failed to reject question");
      
      toast.success("Question rejected successfully");
      fetchQuestions();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filteredQuestions = questions.filter((q) =>
    q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.added_by.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = questions.filter((q) => !q.is_approved).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Q&A Approval Management
              </h1>
              <p className="text-gray-600 mt-1">
                Review and approve questions submitted by employees
              </p>
            </div>
            {pendingCount > 0 && (
              <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-semibold">
                {pendingCount} Pending Approval
              </div>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("pending")}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filter === "pending"
                    ? "bg-yellow-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilter("approved")}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filter === "approved"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">
              {filter === "pending"
                ? "No pending questions"
                : "No questions found"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map((q) => (
              <div
                key={q.id}
                className={`bg-white rounded-lg shadow-sm p-6 border-l-4 ${
                  q.is_approved ? "border-green-500" : "border-yellow-500"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Status Badge */}
                    <div className="mb-3">
                      {q.is_approved ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          ✓ Approved
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          ⏳ Pending Approval
                        </span>
                      )}
                    </div>

                    {/* Question */}
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      Q: {q.question}
                    </h3>

                    {/* Answer */}
                    <p className="text-gray-600 mb-3">A: {q.answer}</p>

                    {/* Image */}
                    {q.image_url && (
                      <img
                        src={q.image_url}
                        alt="Question attachment"
                        className="max-w-md rounded-lg mb-3 cursor-pointer hover:opacity-90"
                        onClick={() => window.open(q.image_url, "_blank")}
                      />
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {q.tags.split(",").map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>

                    {/* Metadata */}
                    <div className="text-sm text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg">
                      <p>
                        <strong>Added by:</strong> {q.added_by} on{" "}
                        {new Date(q.added_on).toLocaleString()}
                      </p>
                      {q.is_approved && q.approved_by && (
                        <p>
                          <strong>Approved by:</strong> {q.approved_by} on{" "}
                          {new Date(q.approved_on).toLocaleString()}
                        </p>
                      )}
                      {q.modified_by && (
                        <p>
                          <strong>Modified by:</strong> {q.modified_by} on{" "}
                          {new Date(q.modified_on).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!q.is_approved && (
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(q.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 whitespace-nowrap"
                      >
                        <Check size={18} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(q.id)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 whitespace-nowrap"
                      >
                        <X size={18} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QAApprovalPage;
