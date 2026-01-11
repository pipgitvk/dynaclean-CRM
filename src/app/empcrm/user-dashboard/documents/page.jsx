"use client";

import { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  Eye,
  Image,
  FileCheck
} from "lucide-react";

export default function UserDocuments() {
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/empcrm/documents");
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data);
      } else {
        alert(data.error || "Failed to fetch documents");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (!documents) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No documents found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          My Documents
        </h1>
        <p className="text-gray-600 mt-2">View and download your documents</p>
      </div>

      {/* Employee Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-4">
          {documents.profile_photo && (
            <img 
              src={documents.profile_photo} 
              alt="Profile" 
              className="w-20 h-20 rounded-full object-cover border-2 border-blue-500"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{documents.full_name || documents.username}</h2>
            <p className="text-gray-600">Employee ID: {documents.empId}</p>
            <p className="text-sm text-gray-500">Username: {documents.username}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Assets */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Image className="w-5 h-5 text-blue-600" />
            Profile Assets
          </h3>
          
          <div className="space-y-4">
            {documents.profile_photo && (
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Profile Photo</p>
                <div className="flex items-center justify-between">
                  <img 
                    src={documents.profile_photo} 
                    alt="Profile" 
                    className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                  />
                  <div className="flex gap-2">
                    <a
                      href={documents.profile_photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="View"
                    >
                      <Eye className="w-5 h-5" />
                    </a>
                    <a
                      href={documents.profile_photo}
                      download
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {documents.signature && (
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Signature</p>
                <div className="flex items-center justify-between">
                  <img 
                    src={documents.signature} 
                    alt="Signature" 
                    className="w-24 h-24 object-contain rounded-lg border border-gray-200 bg-white"
                  />
                  <div className="flex gap-2">
                    <a
                      href={documents.signature}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="View"
                    >
                      <Eye className="w-5 h-5" />
                    </a>
                    <a
                      href={documents.signature}
                      download
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {!documents.profile_photo && !documents.signature && (
              <p className="text-center text-gray-500 py-4">No profile assets uploaded</p>
            )}
          </div>
        </div>

        {/* Document Checklist */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-green-600" />
            Document Checklist
          </h3>
          
          {documents.documents_checklist && Object.keys(documents.documents_checklist).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(documents.documents_checklist).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                    value ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm text-gray-700">
                    {key.replace('document_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No checklist items</p>
          )}
        </div>
      </div>

      {/* Uploaded Documents */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Uploaded Documents ({documents.documents?.length || 0})
        </h3>
        
        {documents.documents && documents.documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.documents.map((doc, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate mb-1">{getFileName(doc)}</p>
                    {typeof doc === 'object' && doc.uploadedAt && (
                      <p className="text-xs text-gray-500 mb-2">
                        Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                        {doc.uploadedBy && ` by ${doc.uploadedBy}`}
                      </p>
                    )}
                    {getDocumentTypes(doc).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {getDocumentTypes(doc).map((type, idx) => (
                          <span key={idx} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {formatDocumentType(type)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <a
                    href={getFileUrl(doc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </a>
                  <a
                    href={getFileUrl(doc)}
                    download
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No documents uploaded yet</p>
            <p className="text-sm text-gray-400">Contact HR to upload your documents</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> If you need to update or add documents, please contact your HR department.
          All documents are managed by HR/Admin for security and compliance purposes.
        </p>
      </div>
    </div>
  );
}
