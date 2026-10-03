'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useEffect } from 'react';

export default function AddThirdPartyEngineerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [files, setFiles] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
    address: '',
    state: '',
    geo_location: '',
    remark: '',
  });

  const [fileInputs, setFileInputs] = useState([{ name: '', file: null }]);

  useEffect(() => {
    // Check if user has permission by making a test API call
    const checkAccess = async () => {
      try {
        const response = await fetch('/api/third-party-engineers?limit=1&offset=0');
        if (response.status === 403) {
          setAccessDenied(true);
          toast.error('Access denied: Only Super Admin can create engineers');
          setTimeout(() => router.push('/admin-dashboard'), 2000);
        }
      } catch (error) {
        console.error('Error checking access:', error);
      }
    };
    checkAccess();
  }, [router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileInputChange = (idx, field, value) => {
    const newInputs = [...fileInputs];
    newInputs[idx] = { ...newInputs[idx], [field]: value };
    setFileInputs(newInputs);
  };

  const handleFileSelect = (idx, file) => {
    const newInputs = [...fileInputs];
    newInputs[idx] = { ...newInputs[idx], file };
    setFileInputs(newInputs);
  };

  const addFileInput = () => {
    setFileInputs([...fileInputs, { name: '', file: null }]);
  };

  const removeFileInput = (idx) => {
    setFileInputs(fileInputs.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.mobile.trim()) {
      toast.error('Mobile is required');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!formData.password.trim()) {
      toast.error('Password is required');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setLoading(true);

      // Create engineer
      const response = await fetch('/api/third-party-engineers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          mobile: formData.mobile.trim(),
          email: formData.email.trim(),
          password: formData.password,
          address: formData.address.trim(),
          state: formData.state.trim(),
          geo_location: formData.geo_location.trim(),
          remark: formData.remark.trim(),
        }),
      });

      if (response.status === 403) {
        toast.error('Access denied: Only Super Admin can create engineers');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create engineer');
      }

      const result = await response.json();
      const engineer_id = result.engineer_id;

      // Upload attachments if any
      if (fileInputs.some((f) => f.file)) {
        const formDataAttachments = new FormData();

        fileInputs.forEach((f) => {
          if (f.file) {
            formDataAttachments.append('files', f.file);
            formDataAttachments.append('attachmentNames', f.name || f.file.name);
          }
        });

        const attachResponse = await fetch(
          `/api/third-party-engineers/${engineer_id}/attachments`,
          {
            method: 'POST',
            body: formDataAttachments,
          }
        );

        if (!attachResponse.ok) {
          console.error('Warning: Failed to upload some attachments');
        }
      }

      toast.success('Engineer created successfully');
      router.push('/admin-dashboard/third-party-engineers');
    } catch (error) {
      console.error('Error creating engineer:', error);
      toast.error(error.message || 'Failed to create engineer');
    } finally {
      setLoading(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-4">
              <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-slate-600 font-semibold">Access Denied</p>
              <p className="text-slate-500 mt-2">Only Super Admin can access this page</p>
            </div>
            <Link
              href="/admin-dashboard"
              className="text-blue-600 hover:underline"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin-dashboard/third-party-engineers"
            className="text-blue-600 hover:text-blue-700 text-xl"
          >
            ←
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Add Third Party Engineer</h1>
            <p className="text-slate-600 mt-2">Create a new third-party service engineer profile</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          {/* Basic Information */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Engineer name"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Mobile *</label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  placeholder="10-digit mobile number"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm password"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
              Address Information
            </h2>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Full address"
                  rows="3"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="State"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Geo Location</label>
                  <input
                    type="text"
                    name="geo_location"
                    value={formData.geo_location}
                    onChange={handleInputChange}
                    placeholder="Latitude, Longitude or area"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
              Additional Information
            </h2>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Remark</label>
              <textarea
                name="remark"
                value={formData.remark}
                onChange={handleInputChange}
                placeholder="Any additional remarks or notes"
                rows="4"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Attachments */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
              Attachments
            </h2>

            <div className="space-y-4">
              {fileInputs.map((input, idx) => (
                <div key={idx} className="p-4 border border-slate-300 rounded-lg bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Attachment Name
                      </label>
                      <input
                        type="text"
                        value={input.name}
                        onChange={(e) => handleFileInputChange(idx, 'name', e.target.value)}
                        placeholder="e.g., License, Certificate"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">File</label>
                      <input
                        type="file"
                        onChange={(e) => handleFileSelect(idx, e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {input.file && (
                        <p className="text-xs text-green-600 mt-1">Selected: {input.file.name}</p>
                      )}
                    </div>
                  </div>

                  {fileInputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFileInput(idx)}
                      className="text-red-600 hover:text-red-700 text-sm font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addFileInput}
                className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition text-sm font-semibold"
              >
                + Add Another Attachment
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end pt-6 border-t border-slate-200">
            <Link
              href="/admin-dashboard/third-party-engineers"
              className="px-6 py-3 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-semibold"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Engineer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
