"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Upload, X, Search, Filter, Plus, Edit2, Trash2 } from "lucide-react";

const QAPage = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTag, setFilterTag] = useState("");
  
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    image_url: "",
    tags: "",
  });

  const tags = [
    "SUPERADMIN",
    "ADMIN",
    "SALES",
    "HR HEAD",
    "ACCOUNTANT",
    "SERVICE",
    "SERVICE ENGINEER",
    "HR",
    "WELDER",
    "GRAPHIC DESIGNER",
    "WELDER HELPER",
    "DIGITAL MARKETER",
    "BACK OFFICE",
    "GEM PORTAL",
    "SERVICE TECHNICIAN",
    "DEVELOPER",
    "WAREHOUSE INCHARGE"
  ];

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      let url = "/api/qa";
      const params = new URLSearchParams();
      if (filterTag) params.append("tag", filterTag);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch questions");
      
      const data = await response.json();
      setQuestions(data.questions || []);
      setUserRole(data.userRole || "");
    } catch (err) {
      toast.error(err.message);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [filterTag]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      const response = await fetch("/api/qa/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) throw new Error("Failed to upload image");
      
      const data = await response.json();
      setFormData((prev) => ({ ...prev, image_url: data.url }));
      toast.success("Image uploaded successfully");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.question.trim() || !formData.answer.trim()) {
      toast.error("Question and answer are required");
      return;
    }

    try {
      const method = editingQuestion ? "PUT" : "POST";
      const body = editingQuestion
        ? { ...formData, id: editingQuestion.id }
        : formData;

      const response = await fetch("/api/qa", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to save question");
      
      const data = await response.json();
      toast.success(data.message);
      
      setIsModalOpen(false);
      setEditingQuestion(null);
      setFormData({ question: "", answer: "", image_url: "", tags: "" });
      fetchQuestions();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setFormData({
      question: question.question,
      answer: question.answer,
      image_url: question.image_url || "",
      tags: question.tags,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const response = await fetch(`/api/qa?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete question");
      
      toast.success("Question deleted successfully");
      fetchQuestions();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openAddModal = () => {
    setEditingQuestion(null);
    setFormData({ question: "", answer: "", image_url: "", tags: "" });
    setIsModalOpen(true);
  };

  const filteredQuestions = questions.filter((q) =>
    q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">
              Knowledge Base - Q&A
            </h1>
            <button
              onClick={openAddModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={20} />
              Add Question
            </button>
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
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Tags</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
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
            <p className="text-gray-500 text-lg">No questions found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map((q) => (
              <div key={q.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      Q: {q.question}
                    </h3>
                    <p className="text-gray-600 mb-3">A: {q.answer}</p>
                    
                    {q.image_url && (
                      <img
                        src={q.image_url}
                        alt="Question attachment"
                        className="max-w-md rounded-lg mb-3"
                      />
                    )}
                    
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
                    
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>Added by: {q.added_by} on {new Date(q.added_on).toLocaleDateString()}</p>
                      {q.is_approved && q.approved_by && (
                        <p>Approved by: {q.approved_by} on {new Date(q.approved_on).toLocaleDateString()}</p>
                      )}
                      {q.modified_by && (
                        <p>Modified by: {q.modified_by} on {new Date(q.modified_on).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  
                  {((userRole === "SUPERADMIN" || userRole === "ADMIN") || q.added_by === userRole) && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(q)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 size={18} />
                      </button>
                      {(userRole === "SUPERADMIN" || userRole === "ADMIN") && (
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {!q.is_approved && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-yellow-800 text-sm">⏳ Pending approval</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">
                    {editingQuestion ? "Edit Question" : "Add New Question"}
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question *
                    </label>
                    <textarea
                      name="question"
                      value={formData.question}
                      onChange={handleInputChange}
                      required
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your question..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Answer *
                    </label>
                    <textarea
                      name="answer"
                      value={formData.answer}
                      onChange={handleInputChange}
                      required
                      rows={5}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter the answer..."
                    />
                  </div>

                  {(userRole === "SUPERADMIN" || userRole === "ADMIN") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        name="tags"
                        value={formData.tags}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., SALES, SERVICE, ACCOUNTANT"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Suggested: {tags.join(", ")}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image (Optional)
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg flex items-center gap-2">
                        <Upload size={20} />
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {formData.image_url && (
                        <span className="text-sm text-green-600">✓ Image uploaded</span>
                      )}
                    </div>
                    {formData.image_url && (
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="mt-3 max-w-xs rounded-lg"
                      />
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                    >
                      {editingQuestion ? "Update Question" : "Submit Question"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QAPage;
