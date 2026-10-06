'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { INDIAN_STATES } from '@/lib/indianStates';
import GeoLocationPicker from '@/components/thirdParty/GeoLocationPicker';

export default function EditThirdPartyEngineerPage() {
  const params = useParams();
  const router = useRouter();
  const engineer_id = params.engineer_id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [engineer, setEngineer] = useState(null);
  const [newFileInputs, setNewFileInputs] = useState([{ name: '', file: null }]);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    secondary_contact_number: '',
    email: '',
    password: '',
    confirmPassword: '',
    address: '',
    state: '',
    geo_location: '',
    remark: '',
    service_charge: '',
    status: 'active',
  });

  useEffect(() => {
    if (engineer_id) {
      fetchEngineer();
    }
  }, [engineer_id]);

  const fetchEngineer = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/third-party-engineers/${engineer_id}`);

      if (response.status === 403) {
        toast.error('Access denied: Only ADMIN and SERVICE SUPPORT can edit this page');
        router.push('/user-dashboard');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch engineer');
      }

      const data = await response.json();
      setEngineer(data);
      setFormData({
        name: data.name,
        mobile: data.mobile,
        secondary_contact_number: data.secondary_contact_number || '',
        email: data.email,
        password: '',
        confirmPassword: '',
        address: data.address || '',
        state: data.state || '',
        geo_location: data.geo_location || '',
        remark: data.remark || '',
        service_charge:
          data.service_charge != null && data.service_charge !== ''
            ? String(data.service_charge)
            : '',
        status: data.status,
      });
    } catch (error) {
      console.error('Error fetching engineer:', error);
      toast.error('Failed to fetch engineer details');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileInputChange = (idx, field, value) => {
    const newInputs = [...newFileInputs];
    newInputs[idx] = { ...newInputs[idx], [field]: value };
    setNewFileInputs(newInputs);
  };

  const handleFileSelect = (idx, file) => {
    const newInputs = [...newFileInputs];
    newInputs[idx] = { ...newInputs[idx], file };
    setNewFileInputs(newInputs);
  };

  const addFileInput = () => {
    setNewFileInputs([...newFileInputs, { name: '', file: null }]);
  };

  const removeFileInput = (idx) => {
    setNewFileInputs(newFileInputs.filter((_, i) => i !== idx));
  };

  const deleteAttachment = async (attachment_id) => {
    if (!confirm('Delete this attachment?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/third-party-engineers/${engineer_id}/attachments?attachment_id=${attachment_id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete attachment');
      }

      setEngineer((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((a) => a.attachment_id !== attachment_id),
      }));

      toast.success('Attachment deleted');
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Failed to delete attachment');
    }
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

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);

      // Update engineer
      const updateData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        state: formData.state.trim(),
        geo_location: formData.geo_location.trim(),
        remark: formData.remark.trim(),
        secondary_contact_number: formData.secondary_contact_number.trim(),
        service_charge: formData.service_charge.trim(),
        status: formData.status,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/third-party-engineers/${engineer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.status === 403) {
        toast.error('Access denied: Only ADMIN and SERVICE SUPPORT can edit engineers');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update engineer');
      }

      // Upload new attachments if any
      if (newFileInputs.some((f) => f.file)) {
        const formDataAttachments = new FormData();

        newFileInputs.forEach((f) => {
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

      toast.success('Engineer updated successfully');
      router.push(`/user-dashboard/third-party-engineers/${engineer_id}`);
    } catch (error) {
      console.error('Error updating engineer:', error);
      toast.error(error.message || 'Failed to update engineer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!engineer) {
    return (
      <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-slate-600 mb-4">Engineer not found</p>
            <Link
              href="/user-dashboard/third-party-engineers"
              className="text-blue-600 hover:underline"
            >
              Back to list
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
            href="/user-dashboard/third-party-engineers"
            className="text-blue-600 hover:text-blue-700 text-xl"
          >
            ←
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Edit Engineer</h1>
            <p className="text-slate-600 mt-2">Update {engineer.name}'s profile</p>
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
                  readOnly
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Mobile number cannot be changed after creation</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Secondary Contact Number</label>
                <input
                  type="tel"
                  name="secondary_contact_number"
                  value={formData.secondary_contact_number}
                  onChange={handleInputChange}
                  placeholder="Alternate contact number"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Status *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">New Password (Leave empty to keep current)</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  rows="3"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">State</label>
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                    {formData.state &&
                      !INDIAN_STATES.includes(formData.state) && (
                        <option value={formData.state}>{formData.state}</option>
                      )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Geo Location</label>
                  <GeoLocationPicker
                    value={formData.geo_location}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, geo_location: val }))
                    }
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Service Charge (₹)</label>
                <input
                  type="number"
                  name="service_charge"
                  value={formData.service_charge}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  placeholder="e.g. 500"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Remark</label>
                <textarea
                  name="remark"
                  value={formData.remark}
                  onChange={handleInputChange}
                  rows="4"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Existing Attachments */}
          {engineer.attachments && engineer.attachments.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
                Current Attachments
              </h2>

              <div className="space-y-3">
                {engineer.attachments.map((attachment) => (
                  <div
                    key={attachment.attachment_id}
                    className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{attachment.attachment_name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Created: {new Date(attachment.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <a
                      href={attachment.file_url || `/api/serve-file?path=public${attachment.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-semibold"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Attachments */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
              Add New Attachments
            </h2>

            <div className="space-y-4">
              {newFileInputs.map((input, idx) => (
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

                  {newFileInputs.length > 1 && (
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
              href={`/user-dashboard/third-party-engineers/${engineer_id}`}
              className="px-6 py-3 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-semibold"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
