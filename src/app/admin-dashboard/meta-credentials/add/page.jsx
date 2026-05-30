'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X } from 'lucide-react';
import MetaFormAssignments from '@/components/MetaFormAssignments';

export default function AddCredentialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [formData, setFormData] = useState({
    verifyToken: '',
    pageId: '',
    pageToken: '',
    formIds: ['']
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await axios.get('/api/employees/active');
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddFormId = () => {
    setFormData(prev => ({
      ...prev,
      formIds: [...prev.formIds, '']
    }));
  };

  const handleRemoveFormId = (index) => {
    if (formData.formIds.length > 1) {
      setFormData(prev => ({
        ...prev,
        formIds: prev.formIds.filter((_, i) => i !== index)
      }));
    }
  };

  const handleFormIdChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      formIds: prev.formIds.map((id, i) => i === index ? value : id)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.verifyToken.trim()) {
      toast.error('Verify token is required');
      return;
    }
    if (!formData.pageId.trim()) {
      toast.error('Page ID is required');
      return;
    }
    if (!formData.pageToken.trim()) {
      toast.error('Page token is required');
      return;
    }

    const validFormIds = formData.formIds.filter(id => id.trim());
    if (validFormIds.length === 0) {
      toast.error('At least one form ID is required');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/meta-credentials', {
        employeeName: null,
        verifyToken: formData.verifyToken,
        pageId: formData.pageId,
        pageToken: formData.pageToken,
        formIds: validFormIds,
        isActive: true
      });

      if (response.data.success) {
        toast.success('Credential added successfully');
        router.push('/admin-dashboard/meta-credentials');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add credential');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin-dashboard/meta-credentials"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Credentials
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Add New Meta Credential</h1>
        <p className="text-gray-600">Add a new Meta Facebook Lead credential and configure form-specific lead distribution</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Verify Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verify Token <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="verifyToken"
              value={formData.verifyToken}
              onChange={handleInputChange}
              placeholder="Your webhook verify token"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Token used to verify webhook requests from Meta
            </p>
          </div>

          {/* Page ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Page ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="pageId"
              value={formData.pageId}
              onChange={handleInputChange}
              placeholder="Your Facebook Page ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              The ID of your Facebook Page
            </p>
          </div>

          {/* Page Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Page Access Token <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="pageToken"
              value={formData.pageToken}
              onChange={handleInputChange}
              placeholder="Your Facebook Page Access Token"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Token with permissions to read leads from your page
            </p>
          </div>

          {/* Form IDs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead Form IDs <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {formData.formIds.map((formId, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => handleFormIdChange(index, e.target.value)}
                    placeholder="e.g., 1277072124613148"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  {formData.formIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFormId(index)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Credential'}
            </button>
            <Link
              href="/admin-dashboard/meta-credentials"
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
