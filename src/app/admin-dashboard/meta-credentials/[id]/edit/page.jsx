'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react';

export default function EditCredentialPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [formData, setFormData] = useState({
    employeeName: '',
    verifyToken: '',
    pageId: '',
    pageToken: '',
    formIds: [''],
    isActive: true
  });

  useEffect(() => {
    fetchCredential();
    fetchEmployees();
  }, [params.id]);

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

  const fetchCredential = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/meta-credentials/${params.id}`);
      if (response.data.success) {
        const cred = response.data.data;
        console.log('Fetched credential:', cred);
        console.log('formIds from API:', cred.formIds, 'Type:', typeof cred.formIds);
        
        // Ensure formIds is always an array
        let formIds = [];
        if (Array.isArray(cred.formIds) && cred.formIds.length > 0) {
          formIds = cred.formIds;
        } else {
          formIds = [''];
        }
        
        console.log('Setting formIds to:', JSON.stringify(formIds));
        
        setFormData({
          employeeName: cred.employeeName || '',
          verifyToken: cred.verifyToken || '',
          pageId: cred.pageId || '',
          pageToken: cred.pageToken || '',
          formIds: formIds,
          isActive: cred.isActive !== undefined ? cred.isActive : true
        });
      }
    } catch (error) {
      toast.error('Failed to fetch credential');
      console.error(error);
      router.push('/admin-dashboard/meta-credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
    if (!formData.employeeName.trim()) {
      toast.error('Employee name is required');
      return;
    }
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
      setSaving(true);
      const response = await axios.put(`/api/meta-credentials/${params.id}`, {
        ...formData,
        formIds: validFormIds
      });

      if (response.data.success) {
        toast.success('Credential updated successfully');
        router.push('/admin-dashboard/meta-credentials');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update credential');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Meta Credential</h1>
        <p className="text-gray-600">Update Meta Facebook Lead credential for {formData.employeeName}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employee Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee <span className="text-red-500">*</span>
            </label>
            {loadingEmployees ? (
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Loading employees...
              </div>
            ) : (
              <select
                name="employeeName"
                value={formData.employeeName}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select an employee</option>
                {employees.map((emp) => (
                  <option key={emp.username} value={emp.username}>
                    {emp.name || emp.username}
                  </option>
                ))}
              </select>
            )}
          </div>

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
          </div>

          {/* Form IDs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead Form IDs <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {Array.isArray(formData.formIds) && formData.formIds.map((formId, index) => (
                <div key={`formId-${index}-${formId}`} className="flex gap-2">
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
            <button
              type="button"
              onClick={handleAddFormId}
              className="mt-2 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Another Form ID
            </button>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              id="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active (this credential will be used for lead syncing)
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
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
