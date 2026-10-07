'use client';

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, User, Calendar, CheckCircle, XCircle, Filter, X, ChevronLeft, ChevronRight, Tag } from 'lucide-react';

function ProductInterestBadge({ value, className = '' }) {
  const text = String(value || '').trim();
  if (!text) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-start gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800 whitespace-normal break-words text-left max-w-full ${className}`}
    >
      <Tag className="w-3 h-3 shrink-0 mt-0.5" />
      <span>{text}</span>
    </span>
  );
}

export default function MetaFormLeadsTable({ formIds, productInterestByFormId = {} }) {
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

  const getLeadProductInterest = (lead) => {
    const fromColumn =
      lead.products_interest ??
      lead.productsInterest ??
      '';
    if (String(fromColumn).trim()) return String(fromColumn).trim();
    const fieldData = lead.fieldData || lead.field_data || [];
    if (!Array.isArray(fieldData)) return '';
    const names = [
      'product_interest',
      'products_interest',
      'which_product_are_you_interested_in?',
      'which_product_are_you_interested_in',
    ];
    for (const name of names) {
      const field = fieldData.find(
        (f) => String(f.name || '').toLowerCase() === name.toLowerCase()
      );
      const val = field?.values?.[0];
      if (val != null && String(val).trim()) return String(val).trim();
    }
    return '';
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

  const formatLeadCreatedAt = (lead) => {
    if (!lead.created_at) return 'N/A';
    return new Date(lead.created_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const renderLeadStatus = (lead) =>
    lead.is_imported_to_crm ? (
      <div className="flex items-center gap-1 text-green-600 text-sm">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span>Imported</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-red-600 text-sm">
        <XCircle className="w-4 h-4 shrink-0" />
        <span>Not Imported</span>
      </div>
    );

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col min-w-0">
            <label className="text-xs font-medium text-gray-600 mb-1">Import Status</label>
            <select
              value={importFilter}
              onChange={(e) => setImportFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="imported">Imported</option>
              <option value="not_imported">Not Imported</option>
            </select>
          </div>
          <div className="flex flex-col min-w-0">
            <label className="text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <TypeableDateFilterInput value={startDate} onChange={setStartDate} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div className="flex flex-col min-w-0">
            <label className="text-xs font-medium text-gray-600 mb-1">End Date</label>
            <TypeableDateFilterInput value={endDate} onChange={setEndDate} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <button
            onClick={clearFilters}
            className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 flex items-center justify-center gap-2 lg:self-end"
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
            <div className="px-3 sm:px-4 py-3 bg-gray-50 border-b flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="flex flex-col gap-2 min-w-0 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">Form ID</span>
                  <span className="text-xs sm:text-sm text-gray-600 font-mono break-all">{formId}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full shrink-0">
                    {leads.length} leads
                  </span>
                </div>
                {productInterestByFormId[formId] && (
                  <ProductInterestBadge value={productInterestByFormId[formId]} className="w-full sm:w-auto" />
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-white">
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
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {leads.map((lead) => (
                        <div
                          key={`m-${lead.id || lead.leadgen_id}-${lead.assigned_to}`}
                          className="border border-gray-200 rounded-lg p-3 shadow-sm bg-white space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-gray-900 text-sm break-words">
                              {getLeadName(lead)}
                            </p>
                            {renderLeadStatus(lead)}
                          </div>
                          <div className="text-xs space-y-1.5 text-gray-700">
                            <p>
                              <span className="font-medium text-gray-500">Phone: </span>
                              <span className="font-mono break-all">{getLeadPhone(lead)}</span>
                            </p>
                            <p className="break-all">
                              <span className="font-medium text-gray-500">Email: </span>
                              {getLeadEmail(lead)}
                            </p>
                            <p>
                              <span className="font-medium text-gray-500">Assigned: </span>
                              {lead.assigned_to || lead.employee_name || 'N/A'}
                            </p>
                            <p>
                              <span className="font-medium text-gray-500">Created: </span>
                              {formatLeadCreatedAt(lead)}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500 block mb-1">Product</span>
                            <ProductInterestBadge value={getLeadProductInterest(lead)} className="w-full" />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm min-w-[720px]">
                        <thead className="bg-gray-100 text-left">
                          <tr>
                            <th className="p-2 border">Name</th>
                            <th className="p-2 border">Phone</th>
                            <th className="p-2 border">Email</th>
                            <th className="p-2 border min-w-[200px]">Product</th>
                            <th className="p-2 border">Assigned To</th>
                            <th className="p-2 border">Status</th>
                            <th className="p-2 border">Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead) => (
                            <tr key={`${lead.id || lead.leadgen_id}-${lead.assigned_to}`} className="border-t">
                              <td className="p-2 border font-medium">
                                {getLeadName(lead)}
                              </td>
                              <td className="p-2 border font-mono text-xs">
                                {getLeadPhone(lead)}
                              </td>
                              <td className="p-2 border text-xs">
                                {getLeadEmail(lead)}
                              </td>
                              <td className="p-2 border align-top min-w-[200px] max-w-md">
                                <ProductInterestBadge value={getLeadProductInterest(lead)} />
                              </td>
                              <td className="p-2 border font-semibold">
                                {lead.assigned_to || lead.employee_name || 'N/A'}
                              </td>
                              <td className="p-2 border">{renderLeadStatus(lead)}</td>
                              <td className="p-2 border text-xs whitespace-nowrap">
                                {formatLeadCreatedAt(lead)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t">
                      <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                        Showing {currentPage * 50 + 1}-{Math.min((currentPage + 1) * 50, pagination[formId]?.total || leads.length)} of {pagination[formId]?.total || leads.length} leads
                      </div>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <button
                          onClick={handlePrevPage}
                          disabled={currentPage === 0}
                          className="flex-1 sm:flex-none px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-sm"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Prev
                        </button>
                        <span className="text-sm text-gray-600 px-2">
                          Page {currentPage + 1}
                        </span>
                        <button
                          onClick={handleNextPage}
                          disabled={!pagination[formId]?.hasMore}
                          className="flex-1 sm:flex-none px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-sm"
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
