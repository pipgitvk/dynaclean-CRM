'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Eye } from 'lucide-react';

export default function EmployeeExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [approving, setApproving] = useState(false);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('All');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    // Set default date range to current month (1st to last day)
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFromDate(currentMonthStart.toISOString().split('T')[0]);
    setToDate(currentMonthEnd.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchEmployeeExpenses();
    }
  }, [fromDate, toDate]);

  const fetchEmployeeExpenses = async () => {
    if (!fromDate || !toDate) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        fromDate,
        toDate
      });
      
      const response = await fetch(`/api/empcrm/manager-expenses?${params}`);
      const data = await response.json();

      if (data.success) {
        setExpenses(data.data || []);
        
        // Extract unique employees for dropdown from the fetched data
        const uniqueEmployees = [...new Set(data.data.map(expense => expense.username))].filter(Boolean);
        setEmployees(uniqueEmployees);
      } else {
        setError(data.error || 'Failed to fetch expenses');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch expenses');
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter((expense) => {
    // Filter by status
    if (filterStatus !== 'All' && expense.approval_status !== filterStatus) return false;
    
    // Filter by employee (client-side filter for immediate UI response)
    if (selectedEmployee !== 'All' && expense.username !== selectedEmployee) return false;
    
    return true;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.TravelDate) - new Date(a.TravelDate);
      case 'amount':
        return parseFloat(b.OtherExpenses || 0) - parseFloat(a.OtherExpenses || 0);
      case 'employee':
        return (a.username || '').localeCompare(b.username || '');
      default:
        return 0;
    }
  });

  const calculateTotalAmount = (expense) => {
    const ticketCost = parseFloat(expense.TicketCost || 0);
    const hotelCost = parseFloat(expense.HotelCost || 0);
    const mealsCost = parseFloat(expense.MealsCost || 0);
    const otherExpenses = parseFloat(expense.OtherExpenses || 0);
    return ticketCost + hotelCost + mealsCost + otherExpenses;
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      Pending: 'bg-yellow-100 text-yellow-800',
      Approved: 'bg-green-100 text-green-800',
      Rejected: 'bg-red-100 text-red-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleViewDetails = (expense) => {
    setSelectedExpense(expense);
    setRejectionRemarks('');
    // Set default approved amount to total
    const total = calculateTotalAmount(expense);
    setApprovedAmount(total.toString());
    setShowModal(true);
  };

  const handleApprove = async () => {
    if (!selectedExpense) return;
    
    // Validate approved amount
    if (!approvedAmount || parseFloat(approvedAmount) <= 0) {
      alert('Please enter a valid approved amount');
      return;
    }

    try {
      setApproving(true);
      const response = await fetch('/api/empcrm/manager-expenses/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseId: selectedExpense.id,
          status: 'Approved',
          approvedAmount: parseFloat(approvedAmount),
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Expense approved successfully!');
        setShowModal(false);
        setSelectedExpense(null);
        setApprovedAmount('');
        fetchEmployeeExpenses();
      } else {
        alert('Error: ' + (data.error || 'Failed to approve'));
      }
    } catch (err) {
      alert('Error approving expense: ' + err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedExpense) return;
    try {
      setApproving(true);
      const response = await fetch('/api/empcrm/manager-expenses/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseId: selectedExpense.id,
          status: 'Rejected',
          remarks: rejectionRemarks,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Expense rejected successfully!');
        setShowModal(false);
        setSelectedExpense(null);
        setRejectionRemarks('');
        fetchEmployeeExpenses();
      } else {
        alert('Error: ' + (data.error || 'Failed to reject'));
      }
    } catch (err) {
      alert('Error rejecting expense: ' + err.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Employee Expenses</h1>
          <p className="text-gray-600 mt-1">
            View and manage expenses from your reporting team
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="mb-6 bg-white rounded-lg shadow p-4 space-y-4">
          {/* Date Filter Row */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-4 items-center">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">From Date:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">To Date:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Employee:</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
                >
                  <option value="All">All Employees</option>
                  {employees.map((employee) => (
                    <option key={employee} value={employee}>
                      {employee}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  const today = new Date();
                  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                  setFromDate(currentMonthStart.toISOString().split('T')[0]);
                  setToDate(currentMonthEnd.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium mt-6"
              >
                Current Month
              </button>
            </div>
          </div>

          {/* Status and Sort Row */}
          <div className="flex flex-wrap gap-4 items-center justify-between border-t pt-4">
            <div className="flex gap-3 flex-wrap">
              {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="date">Latest First</option>
                <option value="amount">Highest Amount</option>
                <option value="employee">Employee Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600">Total Employees</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {new Set(sortedExpenses.map((e) => e.username)).size}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600">Total Expenses</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              ₹
              {sortedExpenses
                .reduce((sum, e) => sum + calculateTotalAmount(e), 0)
                .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600">Pending Review</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {sortedExpenses.filter((e) => e.approval_status === 'Pending').length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-600">Approved</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {sortedExpenses.filter((e) => e.approval_status === 'Approved').length}
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {sortedExpenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg font-medium">No expenses found</p>
              <p className="text-sm mt-1">
                {filterStatus === 'All'
                  ? 'Your reporting team has not submitted any expenses yet.'
                  : `No ${filterStatus.toLowerCase()} expenses found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Approved By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {expense.username}
                        </div>
                        <div className="text-sm text-gray-500">
                          {expense.person_name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(expense.TravelDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="max-w-xs truncate" title={`${expense.FromLocation} → ${expense.Tolocation}`}>
                          {expense.FromLocation} → {expense.Tolocation}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        ₹{calculateTotalAmount(expense).toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            expense.approval_status
                          )}`}
                        >
                          {expense.approval_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {expense.approved_by || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleViewDetails(expense)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                          title="View Details"
                        >
                          <Eye size={16} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showModal && selectedExpense && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Expense Details</h2>
                <p className="text-blue-100 text-sm mt-1">
                  {selectedExpense.approval_status && (
                    <>
                      Status:{' '}
                      <span
                        className={`font-semibold ${
                          selectedExpense.approval_status === 'Approved'
                            ? 'text-green-300'
                            : selectedExpense.approval_status === 'Rejected'
                            ? 'text-red-300'
                            : 'text-yellow-300'
                        }`}
                      >
                        {selectedExpense.approval_status}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-blue-100 text-3xl font-light"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Left and Right columns layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">Status</p>
                    <p className="mt-1">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                          selectedExpense.approval_status
                        )}`}
                      >
                        {selectedExpense.approval_status}
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Username</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedExpense.username}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">From Location</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedExpense.FromLocation}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">To Location</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedExpense.Tolocation}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Description</p>
                    <p className="mt-1 text-gray-700 text-sm leading-relaxed">
                      {selectedExpense.description || 'N/A'}
                    </p>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm font-semibold text-green-900">
                      Total: ₹{calculateTotalAmount(selectedExpense).toLocaleString('en-IN', {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Meeting Person</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedExpense.person_name || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Contact</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedExpense.person_contact || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Mode</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedExpense.ConveyanceMode}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Distance</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedExpense.distance} Km
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Travel Date</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {new Date(selectedExpense.TravelDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Cost Breakdown</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Ticket</span>
                      <span className="font-medium">
                        ₹{parseFloat(selectedExpense.TicketCost || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Hotel</span>
                      <span className="font-medium">
                        ₹{parseFloat(selectedExpense.HotelCost || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Meals</span>
                      <span className="font-medium">
                        ₹{parseFloat(selectedExpense.MealsCost || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Other</span>
                      <span className="font-medium">
                        ₹{parseFloat(selectedExpense.OtherExpenses || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span className="text-green-700">
                        ₹{calculateTotalAmount(selectedExpense).toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              {selectedExpense.attachments && (
                <div className="border-t pt-6">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Attachments</p>
                  <div className="space-y-2">
                    {selectedExpense.attachments.split(',').map((attachment, idx) => (
                      <a
                        key={idx}
                        href={attachment.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 hover:bg-blue-50 rounded text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <span>•</span>
                        {attachment.split('/').pop()}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Amount - Show for all statuses */}
              {selectedExpense.approval_status === 'Pending' ? (
                <div className="border-t pt-6">
                  <label className="text-sm font-medium text-gray-700">
                    Approved Amount <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    placeholder="Enter approved amount..."
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: ₹{calculateTotalAmount(selectedExpense).toLocaleString('en-IN', {
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              ) : (
                selectedExpense.approval_status === 'Approved' && (
                  <div className="border-t pt-6">
                    <label className="text-sm font-medium text-gray-700">Approved Amount</label>
                    <div className="mt-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-800 font-semibold">
                      ₹{parseFloat(selectedExpense.approved_amount || 0).toLocaleString('en-IN', {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                )
              )}

              {/* Rejection Remarks - Show only if status is Pending */}
              {selectedExpense.approval_status === 'Pending' && (
                <div className="border-t pt-6">
                  <label className="text-sm font-medium text-gray-700">
                    Remarks (for rejection):
                  </label>
                  <textarea
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    placeholder="Add remarks if rejecting this expense..."
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  />
                </div>
              )}

              {/* Show Description/Remarks for All statuses - Non-editable */}
              {selectedExpense.description && (
                <div className="border-t pt-6">
                  <label className="text-sm font-medium text-gray-700">Description/Remarks</label>
                  <div className="mt-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700">
                    {selectedExpense.description}
                  </div>
                </div>
              )}

              {/* Approval Date - Show for Approved */}
              {selectedExpense.approval_status === 'Approved' && selectedExpense.approval_date && (
                <div className="border-t pt-6">
                  <label className="text-sm font-medium text-gray-700">Approval Date</label>
                  <div className="mt-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700">
                    {new Date(selectedExpense.approval_date).toLocaleDateString('en-IN')}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-gray-100 px-6 py-4 border-t flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={approving}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-medium disabled:opacity-50"
              >
                Close
              </button>

              {selectedExpense.approval_status === 'Pending' && (
                <>
                  <button
                    onClick={handleReject}
                    disabled={approving}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {approving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Rejecting...
                      </>
                    ) : (
                      'Reject'
                    )}
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {approving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Approving...
                      </>
                    ) : (
                      'Approve'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
