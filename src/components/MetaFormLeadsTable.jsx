'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, User, Calendar, CheckCircle, XCircle, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MetaFormLeadsTable({ formIds }) {
  const [leadsData, setLeadsData] = useState({});
  const [loading, setLoading] = useState({});
  const [importFilter, setImportFilter] = useState('all');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (formIds && formIds.length > 0) {
      // Load leads for all forms
      formIds.forEach(formId => {
        fetchLeadsForForm(formId);
      });
    }
  }, [formIds]);

  useEffect(() => {
    if (formIds && formIds.length > 0) {
      formIds.forEach(formId => {
        fetchLeadsForForm(formId);
      });
    }
  }, [importFilter, startDate, endDate, currentPage]);

  const fetchLeadsForForm = async (formId) => {
    try {
      setLoading(prev => ({ ...prev, [formId]: true }));
      const params = { formId, limit: 50, skip: currentPage * 50 };
      if (importFilter !== 'all') {
        params.isImported = importFilter === 'imported';
      }
      if (startDate) {
        params.startDate = startDate;
      }
      if (endDate) {
        params.endDate = endDate;
      }
      const response = await axios.get('/api/meta-leads', { params });
      if (response.data.success) {
        setLeadsData(prev => ({
          ...prev,
          [formId]: response.data.data
        }));
        setPagination(prev => ({
          ...prev,
          [formId]: response.data.pagination
        }));
      }
    } catch (error) {
      console.error(`Error fetching leads for form ${formId}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [formId]: false }));
    }
  };

  const getLeadName = (lead) => {
    const fieldData = lead.fieldData || [];
    const firstName = fieldData.find(f => f.name === 'first_name')?.values?.[0] || '';
    const lastName = fieldData.find(f => f.name === 'last_name')?.values?.[0] || '';
    const fullName = fieldData.find(f => f.name === 'full_name')?.values?.[0] || '';
    
    if (fullName) return fullName;
    if (firstName && lastName) return `${firstName} ${lastName}`;
    return firstName || lastName || 'Unknown';
  };

  const getLeadPhone = (lead) => {
    const fieldData = lead.fieldData || [];
    const phone = fieldData.find(f => f.name === 'phone_number')?.values?.[0] || '';
    return phone || 'N/A';
  };

  const getLeadEmail = (lead) => {
    const fieldData = lead.fieldData || [];
    const email = fieldData.find(f => f.name === 'email')?.values?.[0] || '';
    return email || 'N/A';
  };

  const clearFilters = () => {
    setImportFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(0);
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  if (!formIds || formIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border-t pt-6">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Form Leads</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        View all leads received from each form and their assigned employees.
      </p>

      {/* Filters Section */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-900">Filters</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">Import Status</label>
            <select
              value={importFilter}
              onChange={(e) => setImportFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="imported">Imported</option>
              <option value="not_imported">Not Imported</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 flex items-center gap-2 mt-5"
          >
            <X className="w-4 h-4" />
            Clear Filters
          </button>
        </div>
      </div>

      {formIds.map((formId, index) => {
        const leads = leadsData[formId] || [];
        const isLoading = loading[formId];

        return (
          <div key={formId} className="mb-4 border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">Form ID</span>
                <span className="text-sm text-gray-600 font-mono">{formId}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {leads.length} leads
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              </div>
            </div>

            <div className="p-4 bg-white">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No leads found for this form
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 text-left">
                          <tr>
                            <th className="p-2 border">Name</th>
                            <th className="p-2 border">Phone</th>
                            <th className="p-2 border">Email</th>
                            <th className="p-2 border">Assigned To</th>
                            <th className="p-2 border">Status</th>
                            <th className="p-2 border">Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead) => (
                            <tr key={lead.leadgen_id} className="border-t">
                              <td className="p-2 border font-medium">
                                {getLeadName(lead)}
                              </td>
                              <td className="p-2 border font-mono text-xs">
                                {getLeadPhone(lead)}
                              </td>
                              <td className="p-2 border text-xs">
                                {getLeadEmail(lead)}
                              </td>
                              <td className="p-2 border font-semibold">
                                {lead.assigned_to || lead.employee_name || 'N/A'}
                              </td>
                              <td className="p-2 border">
                                {lead.is_imported_to_crm ? (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Imported</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-red-600">
                                    <XCircle className="w-4 h-4" />
                                    <span>Not Imported</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-2 border text-xs">
                                {lead.created_at ? new Date(lead.created_at).toLocaleString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                }) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        Showing {currentPage * 50 + 1}-{Math.min((currentPage + 1) * 50, pagination[formId]?.total || leads.length)} of {pagination[formId]?.total || leads.length} leads
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrevPage}
                          disabled={currentPage === 0}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {currentPage + 1}
                        </span>
                        <button
                          onClick={handleNextPage}
                          disabled={!pagination[formId]?.hasMore}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
          </div>
        );
      })}
    </div>
  );
}
