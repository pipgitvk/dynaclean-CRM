"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Upload,
  Search,
  Eye,
  Download,
  Edit,
  Trash2,
  FileText,
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  FolderPlus,
} from "lucide-react";
import FolderGrid from "@/components/company-documents/FolderGrid";
import FolderBreadcrumb from "@/components/company-documents/FolderBreadcrumb";

export default function CompanyDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [folderStats, setFolderStats] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingDocument, setEditingDocument] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    documentName: "",
    file: null,
    expiryDate: "",
    isLifetime: false,
    folderCategory: "Uncategorized",
  });

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (currentFolder) params.append("folder", currentFolder);

      const response = await fetch(
        `/api/company-documents?${params.toString()}`
      );
      const data = await response.json();

      if (response.ok) {
        setDocuments(data.documents);
        setFolderStats(data.folderStats || []);
      } else {
        toast.error(data.error || "Failed to fetch documents");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  // Upload/Update document
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.documentName.trim()) {
      toast.error("Document name is required");
      return;
    }

    if (!editingDocument && !formData.file) {
      toast.error("Please select a file to upload");
      return;
    }

    if (!formData.isLifetime && !formData.expiryDate) {
      toast.error("Please select an expiry date or mark as lifetime");
      return;
    }

    try {
      setUploading(true);
      const submitData = new FormData();
      submitData.append("documentName", formData.documentName);
      submitData.append("expiryDate", formData.expiryDate);
      submitData.append("isLifetime", formData.isLifetime);
      submitData.append("folderCategory", formData.folderCategory);

      if (formData.file) {
        submitData.append("file", formData.file);
      }

      const url = editingDocument
        ? `/api/company-documents/${editingDocument.id}`
        : "/api/company-documents";

      const method = editingDocument ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: submitData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Document saved successfully");
        setShowUploadForm(false);
        setEditingDocument(null);
        resetForm();
        fetchDocuments();
      } else {
        toast.error(data.error || "Failed to save document");
      }
    } catch (error) {
      console.error("Error saving document:", error);
      toast.error("Failed to save document");
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const handleDelete = async (document) => {
    if (
      !confirm(`Are you sure you want to delete "${document.document_name}"?`)
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/company-documents/${document.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Document deleted successfully");
        fetchDocuments();
      } else {
        toast.error(data.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  // Edit document
  const handleEdit = (document) => {
    setEditingDocument(document);
    setFormData({
      documentName: document.document_name,
      file: null,
      expiryDate: document.expiry_date || "",
      isLifetime: !document.expiry_date,
      folderCategory: document.folder_category || "Uncategorized",
    });
    setShowUploadForm(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      documentName: "",
      file: null,
      expiryDate: "",
      isLifetime: false,
      folderCategory: currentFolder || "Uncategorized",
    });
  };

  // Handle file change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData((prev) => ({ ...prev, file }));
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // View document
  const handleView = (document) => {
    window.open(document.document_path, "_blank");
  };

  // Download document
  const handleDownload = (document) => {
    const link = document.createElement("a");
    link.href = document.document_path;
    link.download = document.document_name;
    link.click();
  };

  // Check if document is expired
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "Lifetime";
    return new Date(dateString).toLocaleDateString();
  };

  // Filter documents based on search
  const filteredDocuments = documents.filter((doc) =>
    doc.document_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle folder click
  const handleFolderClick = (folderName) => {
    setCurrentFolder(folderName);
    setSearchTerm("");
  };

  useEffect(() => {
    fetchDocuments();
  }, [searchTerm, currentFolder]);

  useEffect(() => {
    // Update form's default folder when current folder changes
    if (currentFolder && !editingDocument) {
      setFormData((prev) => ({ ...prev, folderCategory: currentFolder }));
    }
  }, [currentFolder, editingDocument]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Company Documents
        </h1>
        <p className="text-gray-600">
          Manage and organize company documents with folder-based navigation
        </p>
      </div>

      {/* Breadcrumb */}
      <FolderBreadcrumb
        currentFolder={currentFolder}
        onNavigate={handleFolderClick}
      />

      {/* Folder Grid */}
      <FolderGrid
        folderStats={folderStats}
        currentFolder={currentFolder}
        onFolderClick={handleFolderClick}
      />

      {/* Search and Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowUploadForm(true);
                setEditingDocument(null);
                resetForm();
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        </div>
      </div>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingDocument ? "Edit Document" : "Upload New Document"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Name *
                  </label>
                  <input
                    type="text"
                    name="documentName"
                    value={formData.documentName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Folder Name *
                  </label>
                  <input
                    type="text"
                    name="folderCategory"
                    value={formData.folderCategory}
                    onChange={handleInputChange}
                    list="folder-suggestions"
                    placeholder="Enter folder name or select from suggestions"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <datalist id="folder-suggestions">
                    {folderStats.map((folder) => (
                      <option
                        key={folder.folder_category}
                        value={folder.folder_category}
                      />
                    ))}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">
                    Type a custom folder name or select from existing folders
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Document {!editingDocument && "*"}
                  </label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={!editingDocument}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Allowed formats: PDF, DOCX, XLSX, JPG, PNG (Max 50MB)
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isLifetime"
                      checked={formData.isLifetime}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Lifetime (No Expiry)
                    </span>
                  </label>
                </div>

                {!formData.isLifetime && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date *
                    </label>
                    <input
                      type="date"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={!formData.isLifetime}
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading
                      ? "Saving..."
                      : editingDocument
                      ? "Update Document"
                      : "Upload Document"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadForm(false);
                      setEditingDocument(null);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No documents found{currentFolder && ` in ${currentFolder}`}</p>
            {searchTerm && (
              <p className="text-sm mt-1">Try adjusting your search terms</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folder
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {document.document_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                        {document.folder_category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {document.expiry_date ? (
                          <>
                            {isExpired(document.expiry_date) ? (
                              <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                            )}
                            <span
                              className={`text-sm ${
                                isExpired(document.expiry_date)
                                  ? "text-red-600"
                                  : "text-gray-900"
                              }`}
                            >
                              {formatDate(document.expiry_date)}
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                            <span className="text-sm text-gray-900">
                              Lifetime
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {document.created_by}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {new Date(document.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(document)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(document)}
                          className="text-green-600 hover:text-green-900 p-1 rounded"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(document)}
                          className="text-yellow-600 hover:text-yellow-900 p-1 rounded"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(document)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
