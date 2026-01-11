"use client";

import { useState, useEffect } from "react";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Search,
  Download,
  User,
  Eye,
  Plus
} from "lucide-react";

export default function AdminDocuments() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [selectedDocTypes, setSelectedDocTypes] = useState({});

  const documentsList = [
    { key: "document_10th_certificate", label: "10th Certificate" },
    { key: "document_12th_certificate", label: "12th Certificate" },
    { key: "document_graduation_certificate", label: "Graduation Certificate" },
    { key: "document_professional_certificates", label: "Professional Certificates" },
    { key: "document_dob_proof", label: "DOB Proof" },
    { key: "document_id_proof", label: "ID Proof" },
    { key: "document_address_proof", label: "Address Proof" },
    { key: "document_relieve_experience_letters", label: "Relieve/Experience Letters" },
    { key: "document_salary_slips", label: "Salary Slips" },
    { key: "document_bank_statement", label: "Bank Statement" },
    { key: "document_passport_photos", label: "Passport Photos" },
    { key: "document_pan_copy", label: "PAN Copy" },
    { key: "document_cv", label: "CV/Resume" },
    { key: "document_appointment_ack", label: "Appointment Acknowledgment" },
  ];

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/empcrm/employees");
      const data = await response.json();
      if (data.success) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchDocuments = async (username) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/empcrm/documents?username=${username}`);
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data);
        setSelectedEmployee(username);
        // Pre-populate selected doc types from checklist
        if (data.documents_checklist) {
          setSelectedDocTypes(data.documents_checklist);
        }
      } else {
        alert(data.error || "Failed to fetch documents");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      alert("Error fetching documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e, docKey) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFiles(prev => ({ ...prev, [docKey]: file }));
      // Auto-check the checkbox when file is selected
      setSelectedDocTypes(prev => ({ ...prev, [docKey]: true }));
    }
  };

  const removeFile = (docKey) => {
    setUploadFiles(prev => {
      const updated = { ...prev };
      delete updated[docKey];
      return updated;
    });
  };

  const handleUpload = async () => {
    if (!selectedEmployee) {
      alert("Please select an employee first");
      return;
    }

    // Check if there's anything to update (files or checklist changes)
    const fileKeys = Object.keys(uploadFiles);
    const hasFiles = fileKeys.length > 0;
    const hasChecklistChanges = JSON.stringify(selectedDocTypes) !== JSON.stringify(documents?.documents_checklist || {});
    
    if (!hasFiles && !hasChecklistChanges) {
      alert("No changes to save");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("username", selectedEmployee);
      
      // Add files with their document type keys
      fileKeys.forEach(docKey => {
        formData.append(docKey, uploadFiles[docKey]);
      });

      // Add all document types (including unchecked ones for removal)
      formData.append("documentTypes", JSON.stringify(selectedDocTypes));

      const response = await fetch("/api/empcrm/documents", {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        const message = hasFiles 
          ? `${fileKeys.length} document(s) uploaded and checklist updated` 
          : "Document checklist updated successfully";
        alert(message);
        setShowUploadModal(false);
        setUploadFiles({});
        fetchDocuments(selectedEmployee);
      } else {
        alert(data.error || "Failed to update documents");
      }
    } catch (error) {
      console.error("Error updating documents:", error);
      alert("Error updating documents");
    } finally {
      setUploading(false);
    }
  };

  const handleDocTypeToggle = (key) => {
    setSelectedDocTypes(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDelete = async (documentUrl) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/empcrm/documents?username=${selectedEmployee}&documentUrl=${encodeURIComponent(documentUrl)}`,
        { method: "DELETE" }
      );

      const data = await response.json();
      
      if (data.success) {
        alert("Document deleted successfully");
        fetchDocuments(selectedEmployee);
      } else {
        alert(data.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Error deleting document");
    }
  };

  const getFileName = (doc) => {
    if (typeof doc === 'string') {
      return doc.split('/').pop();
    }
    return doc.name || doc.url?.split('/').pop() || 'Unknown';
  };

  const getFileUrl = (doc) => {
    return typeof doc === 'string' ? doc : doc.url;
  };

  const getDocumentTypes = (doc) => {
    if (typeof doc === 'object' && doc.documentTypes) {
      return doc.documentTypes;
    }
    if (typeof doc === 'object' && doc.type) {
      return [doc.type];
    }
    return [];
  };

  const formatDocumentType = (key) => {
    return key.replace('document_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const filteredEmployees = employees.filter(emp =>
    emp.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.empId?.toString().includes(searchTerm)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          Employee Documents Management
        </h1>
        <p className="text-gray-600 mt-2">View and manage employee documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Employee</h2>
            
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Employee List */}
            <div className="max-h-[600px] overflow-y-auto space-y-2">
              {filteredEmployees.map((emp) => (
                <button
                  key={emp.empId}
                  onClick={() => fetchDocuments(emp.username)}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                    selectedEmployee === emp.username
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-800 truncate">{emp.username}</div>
                      <div className="text-sm text-gray-500">EmpID: {emp.empId}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Documents Display */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-500">Loading documents...</p>
            </div>
          ) : !documents ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select an employee to view documents</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Employee Info */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{documents.full_name || documents.username}</h2>
                    <p className="text-gray-600">Employee ID: {documents.empId}</p>
                  </div>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Manage Documents
                  </button>
                </div>

                {/* Profile Photo & Signature */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {documents.profile_photo && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Profile Photo</p>
                      <img 
                        src={documents.profile_photo} 
                        alt="Profile" 
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                  )}
                  {documents.signature && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Signature</p>
                      <img 
                        src={documents.signature} 
                        alt="Signature" 
                        className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Documents List */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Uploaded Documents ({documents.documents?.length || 0})
                  </h3>
                  
                  {documents.documents && documents.documents.length > 0 ? (
                    <div className="space-y-2">
                      {documents.documents.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-800 truncate">{getFileName(doc)}</p>
                              {typeof doc === 'object' && doc.uploadedAt && (
                                <p className="text-xs text-gray-500">
                                  Uploaded: {new Date(doc.uploadedAt).toLocaleString()}
                                  {doc.uploadedBy && ` by ${doc.uploadedBy}`}
                                </p>
                              )}
                              {getDocumentTypes(doc).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {getDocumentTypes(doc).map((type, idx) => (
                                    <span key={idx} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                      {formatDocumentType(type)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={getFileUrl(doc)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                            <a
                              href={getFileUrl(doc)}
                              download
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDelete(getFileUrl(doc))}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                      No documents uploaded yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Manage Documents & Checklist</h2>
              <p className="text-gray-600 mt-1">
                for {documents?.full_name || selectedEmployee}
                <span className="text-sm text-gray-500 ml-2">• Upload files and/or update document checklist</span>
              </p>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Document Type Selection with Individual Upload */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Document Management
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    (Check to mark as submitted, upload individual files per document type)
                  </span>
                </h3>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {documentsList.map((doc) => {
                    const isChecked = selectedDocTypes[doc.key] === true;
                    const wasAlreadySubmitted = documents?.documents_checklist?.[doc.key] === true;
                    const hasFile = uploadFiles[doc.key];
                    
                    return (
                      <div
                        key={doc.key}
                        className={`flex items-center justify-between gap-2 p-3 rounded border transition-colors ${
                          isChecked
                            ? 'bg-blue-50 border-blue-300' 
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleDocTypeToggle(doc.key)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                          />
                          <span className="text-sm text-gray-700 flex-1">{doc.label}</span>
                        </label>
                        
                        <div className="flex items-center gap-2">
                          {wasAlreadySubmitted && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                              ✓ Submitted
                            </span>
                          )}
                          
                          {hasFile && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full truncate max-w-32" title={hasFile.name}>
                              {hasFile.name}
                            </span>
                          )}
                          
                          <input
                            id={`file_${doc.key}`}
                            type="file"
                            onChange={(e) => handleFileSelect(e, doc.key)}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          />
                          
                          <button
                            type="button"
                            onClick={() => document.getElementById(`file_${doc.key}`)?.click()}
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                            title="Upload file"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          
                          {hasFile && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = URL.createObjectURL(hasFile);
                                  window.open(url, "_blank");
                                }}
                                className="p-1.5 rounded hover:bg-green-100 text-green-600"
                                title="Preview file"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeFile(doc.key)}
                                className="p-1.5 rounded hover:bg-red-100 text-red-600"
                                title="Remove file"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-3 flex items-center justify-between text-xs bg-gray-50 p-3 rounded">
                  <div className="flex gap-4">
                    <p className="text-green-600">
                      ✓ {Object.values(selectedDocTypes).filter(v => v).length} marked as submitted
                    </p>
                    <p className="text-blue-600">
                      📎 {Object.keys(uploadFiles).length} file(s) selected for upload
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDocTypes({});
                      setUploadFiles({});
                    }}
                    className="text-red-600 hover:text-red-700 underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles({});
                  setSelectedDocTypes({});
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploading 
                  ? "Saving..." 
                  : Object.keys(uploadFiles).length > 0 
                    ? "Upload & Save" 
                    : "Save Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
