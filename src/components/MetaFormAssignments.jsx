'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Trash2, Users } from 'lucide-react';

export default function MetaFormAssignments({ formIds, employees }) {
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingUsernames, setSavingUsernames] = useState({});
  const [priorityTouched, setPriorityTouched] = useState({});
  const [maxTouched, setMaxTouched] = useState({});

  useEffect(() => {
    if (formIds && formIds.length > 0) {
      fetchAssignments();
    }
  }, [formIds]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/meta-form-assignments');
      if (response.data.success) {
        const assignmentsMap = {};
        response.data.data.forEach(assignment => {
          if (!assignmentsMap[assignment.form_id]) {
            assignmentsMap[assignment.form_id] = [];
          }
          assignmentsMap[assignment.form_id].push(assignment);
        });
        setAssignments(assignmentsMap);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  
  const addAssignment = async (formId, username, priority, maxLeads) => {
    try {
      setSavingUsernames(prev => ({ ...prev, [`${formId}-${username}`]: true }));
      await axios.post('/api/meta-form-assignments', {
        formId,
        username,
        priority: parseInt(priority) || 0,
        maxLeads: parseInt(maxLeads) || 0
      });
      toast.success('Assignment added');
      fetchAssignments();
    } catch (error) {
      toast.error('Failed to add assignment');
      console.error(error);
    } finally {
      setSavingUsernames(prev => ({ ...prev, [`${formId}-${username}`]: false }));
    }
  };

  const deleteAssignment = async (formId, username) => {
    try {
      setSavingUsernames(prev => ({ ...prev, [`${formId}-${username}`]: true }));
      await axios.delete(`/api/meta-form-assignments?formId=${encodeURIComponent(formId)}&username=${encodeURIComponent(username)}`);
      toast.success('Assignment deleted');
      fetchAssignments();
    } catch (error) {
      toast.error('Failed to delete assignment');
      console.error(error);
    } finally {
      setSavingUsernames(prev => ({ ...prev, [`${formId}-${username}`]: false }));
    }
  };

  const updateAssignment = async (formId, username, priority, maxLeads) => {
    try {
      setSavingUsernames(prev => ({ ...prev, [`${formId}-${username}`]: true }));
      await axios.post('/api/meta-form-assignments', {
        formId,
        username,
        priority: parseInt(priority) || 0,
        maxLeads: parseInt(maxLeads) || 0
      });
      toast.success('Assignment updated');
      fetchAssignments();
    } catch (error) {
      toast.error('Failed to update assignment');
      console.error(error);
    } finally {
      setSavingUsernames(prev => ({ ...prev, [`${formId}-${username}`]: false }));
    }
  };

  if (!formIds || formIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border-t pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Form-Specific Lead Distribution</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Assign specific employees to each form with custom priorities. This overrides general lead distribution.
      </p>

      {formIds.map((formId, index) => (
        <div key={formId} className="mb-4 border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <span className="font-medium text-gray-900">Form ID {index + 1}</span>
            <span className="ml-2 text-sm text-gray-600 font-mono">{formId}</span>
          </div>

          <div className="p-4 bg-white">
            {/* Add new assignment */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Add Assignment</h4>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-600 mb-1 block">Employee</label>
                  <select
                    id={`employee-${formId}`}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Select employee</option>
                    {employees && employees.map((emp) => (
                      <option key={emp.username} value={emp.username}>
                        {emp.name || emp.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-600 mb-1 block">Priority</label>
                  <input
                    type="number"
                    id={`priority-${formId}`}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-600 mb-1 block">Max Leads</label>
                  <input
                    type="number"
                    id={`maxLeads-${formId}`}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const employeeSelect = document.getElementById(`employee-${formId}`);
                    const priorityInput = document.getElementById(`priority-${formId}`);
                    const maxLeadsInput = document.getElementById(`maxLeads-${formId}`);
                    
                    if (employeeSelect.value) {
                      addAssignment(
                        formId,
                        employeeSelect.value,
                        priorityInput.value,
                        maxLeadsInput.value
                      );
                      employeeSelect.value = '';
                      priorityInput.value = '';
                      maxLeadsInput.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                  disabled={savingUsernames[`${formId}-new`]}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Existing assignments table */}
            {assignments[formId] && assignments[formId].length > 0 && (
              <div className="bg-gray-100 border rounded p-4 shadow">
                <h4 className="font-semibold mb-2">Current Assignments</h4>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-left">
                      <tr>
                        <th className="p-2 border">Username</th>
                        <th className="p-2 border">Priority</th>
                        <th className="p-2 border">Max Leads</th>
                        <th className="p-2 border w-40">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments[formId].map((assignment) => (
                        <tr key={assignment.username} className="border-t">
                          <td className="p-2 border font-semibold">{assignment.username}</td>
                          <td className="p-2 border">
                            <input
                              type="number"
                              className="w-full border rounded p-1"
                              value={
                                priorityTouched[`${formId}-${assignment.username}`]
                                  ? assignment.priority || ""
                                  : (assignment.priority ?? 0)
                              }
                              onFocus={() =>
                                setPriorityTouched((s) => ({
                                  ...s,
                                  [`${formId}-${assignment.username}`]: true,
                                }))
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                const v = parseInt(raw, 10);
                                setAssignments((prev) => ({
                                  ...prev,
                                  [formId]: prev[formId].map((a) =>
                                    a.username === assignment.username
                                      ? { ...a, priority: Number.isNaN(v) ? 0 : v }
                                      : a,
                                  ),
                                }));
                              }}
                            />
                          </td>
                          <td className="p-2 border">
                            <input
                              type="number"
                              className="w-full border rounded p-1"
                              value={
                                maxTouched[`${formId}-${assignment.username}`]
                                  ? assignment.max_leads || ""
                                  : (assignment.max_leads ?? 0)
                              }
                              onFocus={() =>
                                setMaxTouched((s) => ({ ...s, [`${formId}-${assignment.username}`]: true }))
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                const v = parseInt(raw, 10);
                                setAssignments((prev) => ({
                                  ...prev,
                                  [formId]: prev[formId].map((a) =>
                                    a.username === assignment.username
                                      ? { ...a, max_leads: Number.isNaN(v) ? 0 : v }
                                      : a,
                                  ),
                                }));
                              }}
                            />
                          </td>
                          <td className="p-2 border">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                                onClick={() => updateAssignment(formId, assignment.username, assignment.priority, assignment.max_leads)}
                                disabled={!!savingUsernames[`${formId}-${assignment.username}`]}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="bg-red-600 text-white px-3 py-1 rounded text-xs"
                                onClick={() => deleteAssignment(formId, assignment.username)}
                                disabled={!!savingUsernames[`${formId}-${assignment.username}`]}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
