'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

function ReturnProductsPage() {
  const [installations, setInstallations] = useState([]);
  const [filteredInstallations, setFilteredInstallations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [showWarehouseInModal, setShowWarehouseInModal] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [quotationItems, setQuotationItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [returnTrackingNo, setReturnTrackingNo] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);
  const [processingWarehouseIn, setProcessingWarehouseIn] = useState(false);
  const [returnImage, setReturnImage] = useState(null);
  const [warehouseGodown, setWarehouseGodown] = useState('Delhi - Mundka');

  const [showExistingReturnsModal, setShowExistingReturnsModal] = useState(false);

  const [existingReturns, setExistingReturns] = useState([]);
  const [existingReturnsLoading, setExistingReturnsLoading] = useState(false);

  useEffect(() => {
    fetchUpcomingInstallations();
    fetchExistingReturns();
  }, []);

  const fetchExistingReturns = async () => {
    try {
      setExistingReturnsLoading(true);
      const response = await axios.get('/api/admin/return-products');
      if (response.data.success) {
        setExistingReturns(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching existing returns:', error);
      toast.error('Failed to load existing returns');
    } finally {
      setExistingReturnsLoading(false);
    }
  };

  useEffect(() => {
    filterInstallations();
  }, [installations, existingReturns, searchTerm]);

  const fetchUpcomingInstallations = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/installation/upcoming?type=all');
      setInstallations(response.data.installations || []);
    } catch (error) {
      console.error('Error fetching installations:', error);
      toast.error('Failed to load installations');
    } finally {
      setLoading(false);
    }
  };

  const filterInstallations = () => {
    // Filter out installations that already have a return entry
    const returnedQuotationNos = new Set(existingReturns.map((r) => r.quotation_no));
    const returnedInvoiceNos = new Set(existingReturns.map((r) => r.invoice_no));

    let filtered = installations.filter((inst) => {
      const quoteNo = inst.quote_number || `QT-${inst.order_id}`;
      const invoiceNo = inst.invoice_number || `INV-${inst.order_id}`;
      // Remove if a full return exists for this order
      const hasFullReturn = existingReturns.some(
        (r) =>
          (r.quotation_no === quoteNo || r.invoice_no === invoiceNo) &&
          r.return_type === 'full'
      );
      if (hasFullReturn) return false;
      return true;
    });

    if (searchTerm) {
      filtered = filtered.filter(
        (inst) =>
          inst.order_id?.toString().includes(searchTerm) ||
          inst.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inst.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inst.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inst.contact?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredInstallations(filtered);
  };

  const handlePartialReturnClick = async (installation) => {
    try {
      setSelectedInstallation(installation);
      setShowPartialModal(true);
      setReturnReason('');
      setReturnTrackingNo('');
      setSelectedItems({});

      // Fetch quotation items
      if (installation.quote_number) {
        const response = await axios.get(`/api/get-quotation?quotation_number=${installation.quote_number}`);
        if (response.data.success) {
          setQuotationItems(response.data.quotation.items || []);
        }
      }
    } catch (error) {
      console.error('Error fetching quotation items:', error);
      toast.error('Failed to load quotation items');
    }
  };

  const handleFullReturnClick = async (installation) => {
    try {
      setSelectedInstallation(installation);
      setShowFullModal(true);
      setReturnReason('');
      setReturnTrackingNo('');

      // Fetch quotation items
      if (installation.quote_number) {
        const response = await axios.get(`/api/get-quotation?quotation_number=${installation.quote_number}`);
        if (response.data.success) {
          setQuotationItems(response.data.quotation.items || []);
        }
      }
    } catch (error) {
      console.error('Error fetching quotation items:', error);
      toast.error('Failed to load quotation items');
    }
  };

  const toggleItemSelection = (item, index) => {
    setSelectedItems((prev) => {
      const key = `${item.item_code}-${index}`;
      if (prev[key]) {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      } else {
        return {
          ...prev,
          [key]: {
            ...item,
            quantity: 1,
          },
        };
      }
    });
  };

  const updateItemQuantity = (item, index, quantity) => {
    const key = `${item.item_code}-${index}`;
    setSelectedItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        quantity: Math.max(1, Math.min(item.quantity, quantity)),
      },
    }));
  };

  const calculateSelectedTotal = () => {
    return Object.values(selectedItems).reduce(
      (total, item) => total + (item.rate * item.quantity),
      0
    );
  };

  const handleSubmitPartialReturn = async () => {
    if (Object.keys(selectedItems).length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    try {
      setProcessingReturn(true);
      const itemsArray = Object.values(selectedItems).map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: item.quantity,
        price_per_unit: item.rate,
        total_price: item.rate * item.quantity,
        serial_no: '',
      }));

      const returnData = {
        quotation_no: selectedInstallation.quote_number || `QT-${selectedInstallation.order_id}`,
        invoice_no: selectedInstallation.invoice_number || `INV-${selectedInstallation.order_id}`,
        model_no: itemsArray.map((i) => i.item_code).join(', '),
        serial_no: '',
        pricing_total: calculateSelectedTotal(),
        tracking_no: returnTrackingNo,
        return_type: 'partial',
        reason: returnReason || 'Partial return from installation',
        customer_id: selectedInstallation.customer_id,
        items: itemsArray,
      };

      const response = await axios.post('/api/admin/return-products', returnData, { withCredentials: true });

      if (response.data.success) {
        toast.success('Partial return initiated successfully');
        setShowPartialModal(false);
        // Optimistically remove this installation from the table
        setInstallations((prev) =>
          prev.filter((i) => i.order_id !== selectedInstallation.order_id)
        );
        fetchUpcomingInstallations();
        fetchExistingReturns();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Failed to process return');
    } finally {
      setProcessingReturn(false);
    }
  };

  const handleSubmitFullReturn = async () => {
    try {
      setProcessingReturn(true);
      // Create items array with all items and full quantity
      const itemsArray = quotationItems.map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: item.quantity,
        price_per_unit: item.rate,
        total_price: item.rate * item.quantity,
        serial_no: '',
      }));

      const returnData = {
        quotation_no: selectedInstallation.quote_number || `QT-${selectedInstallation.order_id}`,
        invoice_no: selectedInstallation.invoice_number || `INV-${selectedInstallation.order_id}`,
        model_no: itemsArray.map((i) => i.item_code).join(', '),
        serial_no: '',
        pricing_total: itemsArray.reduce((sum, item) => sum + item.total_price, 0),
        tracking_no: returnTrackingNo,
        return_type: 'full',
        reason: returnReason || 'Full return from installation',
        customer_id: selectedInstallation.customer_id,
        items: itemsArray,
      };

      const response = await axios.post('/api/admin/return-products', returnData);

      if (response.data.success) {
        toast.success('Full return initiated successfully');
        setShowFullModal(false);
        // Optimistically remove this installation from the table
        setInstallations((prev) =>
          prev.filter((i) => i.order_id !== selectedInstallation.order_id)
        );
        fetchUpcomingInstallations();
        fetchExistingReturns();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Failed to process return');
    } finally {
      setProcessingReturn(false);
    }
  };

  const handleWarehouseInClick = async (ret) => {
    try {
      setSelectedReturn(ret);
      setShowWarehouseInModal(true);
      setReturnImage(null);
      setWarehouseGodown('Delhi - Mundka');
    } catch (error) {
      console.error('Error opening warehouse in modal:', error);
      toast.error('Failed to open warehouse in modal');
    }
  };

  const handleSubmitWarehouseIn = async () => {
    if (!returnImage) {
      toast.error('Please select an image to upload');
      return;
    }

    try {
      setProcessingWarehouseIn(true);
      const formData = new FormData();
      formData.append('return_image', returnImage);
      formData.append('return_status', 'delivered_in_warehouse');
      formData.append('godown', warehouseGodown);

      const response = await axios.put(
        `/api/admin/return-products/${selectedReturn.id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        toast.success('Warehouse in processed successfully');
        setShowWarehouseInModal(false);
        fetchExistingReturns();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.message || 'Failed to process warehouse in');
    } finally {
      setProcessingWarehouseIn(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      overdue: 'bg-red-100 text-red-800',
      upcoming: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getRowClass = (status) => {
    if (status === 'overdue') return 'bg-red-50';
    if (status === 'upcoming') return 'bg-yellow-50';
    return 'bg-white';
  };

  const dateColor = (status) => {
    return status === 'overdue'
      ? 'text-red-600 font-bold'
      : status === 'upcoming'
      ? 'text-orange-600 font-bold'
      : 'text-gray-800';
  };

  const formatDays = (days) =>
    days < 0
      ? `${Math.abs(days)} days overdue`
      : days === 0
      ? 'Today'
      : `${days} days`;

  const renderActionButtons = (installation) => {
    // Check total quantity from quotation_items
    const totalQty = Number(installation.total_qty) || 0;

    // Check if a partial return already exists for this installation
    const quoteNo = installation.quote_number || `QT-${installation.order_id}`;
    const invoiceNo = installation.invoice_number || `INV-${installation.order_id}`;
    const hasPartialReturn = existingReturns.some(
      (r) =>
        (r.quotation_no === quoteNo || r.invoice_no === invoiceNo) &&
        r.return_type === 'partial'
    );

    // If qty is 1, show only Full Return
    if (totalQty === 1) {
      return (
        <button
          onClick={() => handleFullReturnClick(installation)}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition w-full"
        >
          Full Return
        </button>
      );
    }

    // If qty is more than 1, show both buttons
    return (
      <div className="flex gap-2">
        <button
          onClick={() => !hasPartialReturn && handlePartialReturnClick(installation)}
          disabled={hasPartialReturn}
          title={hasPartialReturn ? 'Partial return already initiated' : ''}
          className={`px-3 py-1 rounded text-xs font-medium transition flex-1 ${
            hasPartialReturn
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
          }`}
        >
          Partial Return
        </button>
        <button
          onClick={() => handleFullReturnClick(installation)}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition flex-1"
        >
          Full Return
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Return Products</h1>
            <p className="text-gray-600 mt-1">Create returns from upcoming installations</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { fetchExistingReturns(); setShowExistingReturnsModal(true); }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              Existing Returns
            </button>
            <button
              onClick={fetchUpcomingInstallations}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                placeholder="Search by Order ID, Model, Name, Company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-right pt-2">
              <p className="text-sm text-gray-600">
                Total: <span className="font-bold text-gray-900">{filteredInstallations.length}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Table Section */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Loading installations...</p>
          </div>
        ) : filteredInstallations.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Order ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Quotation No</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Invoice No</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Model No</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Serial No</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Pricing</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Tracking No</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Delivery</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Days</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstallations.map((inst, index) => (
                    <tr
                      key={inst.order_id || index}
                      className={`${getRowClass(inst.installation_status)} border-b hover:bg-gray-50 transition`}
                    >
                      <td className="px-4 py-4 text-sm text-gray-900 font-medium">#{inst.order_id}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                        {inst.quote_number || `QT-${inst.order_id}`}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {inst.invoice_number || `INV-${inst.order_id}`}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">{inst.model}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{inst.serial_number || 'N/A'}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                        ₹{inst.pricing_total || 0}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">{inst.tracking_no || '-'}</td>
                      <td className={`px-4 py-4 text-sm ${dateColor(inst.installation_status)}`}>
                        {inst.delivery_date}
                      </td>
                      <td className={`px-4 py-4 text-sm font-bold ${dateColor(inst.installation_status)}`}>
                        {formatDays(inst.days_until_installation)}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(inst.installation_status)}`}
                        >
                          {inst.installation_status === 'overdue' ? 'Overdue' : 'Upcoming'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {renderActionButtons(inst)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 text-lg">No installations found</p>
          </div>
        )}

        {/* Existing Returns Section — moved to modal */}
      </div>

      {/* Existing Returns Modal */}
      {showExistingReturnsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Existing Returns</h2>
                <p className="text-gray-600 mt-1">View and manage existing product returns</p>
              </div>
              <div className="flex gap-3 items-center">
                <button
                  onClick={fetchExistingReturns}
                  disabled={existingReturnsLoading}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 text-sm"
                >
                  {existingReturnsLoading ? 'Loading...' : 'Refresh'}
                </button>
                <button
                  onClick={() => setShowExistingReturnsModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {existingReturnsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-4">Loading existing returns...</p>
                </div>
              ) : existingReturns.filter(r => r.return_status !== 'delivered_in_warehouse').length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Quotation No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Invoice No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Model No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Serial No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Pricing</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Tracking No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Return Type</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Created By</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Updated By</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingReturns.filter(r => r.return_status !== 'delivered_in_warehouse').map((ret, index) => (
                        <tr key={ret.id || index} className="border-b hover:bg-gray-50 transition">
                          <td className="px-4 py-4 text-sm text-gray-900 font-medium">{ret.id}</td>
                          <td className="px-4 py-4 text-sm text-gray-900 font-medium">{ret.quotation_no}</td>
                          <td className="px-4 py-4 text-sm text-gray-900">{ret.invoice_no}</td>
                          <td className="px-4 py-4 text-sm text-gray-900">{ret.model_no}</td>
                          <td className="px-4 py-4 text-sm text-gray-900">{ret.serial_no || 'N/A'}</td>
                          <td className="px-4 py-4 text-sm text-gray-900 font-medium">₹{ret.pricing_total || 0}</td>
                          <td className="px-4 py-4 text-sm text-gray-900">{ret.tracking_no || '-'}</td>
                          <td className="px-4 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${ret.return_type === 'full' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                              {ret.return_type === 'full' ? 'Full Return' : 'Partial Return'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              ret.return_status === 'delivered_in_warehouse' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {ret.return_status === 'delivered_in_warehouse' ? 'Delivered in Warehouse' : 'Return Booking'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">{ret.created_by_username || ret.created_by || 'N/A'}</td>
                          <td className="px-4 py-4 text-sm text-gray-900">{ret.updated_by_username || ret.updated_by || 'N/A'}</td>
                          <td className="px-4 py-4 text-sm">
                            <button
                              onClick={() => { setShowExistingReturnsModal(false); handleWarehouseInClick(ret); }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition"
                            >
                              Warehouse In
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 text-lg">No existing returns found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Partial Return Modal */}
      {showPartialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Partial Return</h2>
              <button
                onClick={() => setShowPartialModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {selectedInstallation && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Order Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Order ID:</span>{' '}
                      <span className="font-medium">#{selectedInstallation.order_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Quotation:</span>{' '}
                      <span className="font-medium">
                        {selectedInstallation.quote_number || `QT-${selectedInstallation.order_id}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Company:</span>{' '}
                      <span className="font-medium">{selectedInstallation.company_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Contact:</span>{' '}
                      <span className="font-medium">{selectedInstallation.contact}</span>
                    </div>
                  </div>
                </div>
              )}

              {quotationItems.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Select Products to Return</h3>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Select
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Item Name
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Item Code
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Qty (Total)
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Qty to Return
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Rate
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotationItems.map((item, index) => {
                            const key = `${item.item_code}-${index}`;
                            const isSelected = !!selectedItems[key];
                            const selectedQty = selectedItems[key]?.quantity || 1;
                            const itemTotal = item.rate * selectedQty;

                            return (
                              <tr
                                key={key}
                                className={`border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                              >
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleItemSelection(item, index)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {item.item_name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.item_code}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.quantity}
                                    value={selectedQty}
                                    onChange={(e) =>
                                      updateItemQuantity(item, index, parseInt(e.target.value) || 1)
                                    }
                                    disabled={!isSelected}
                                    className="w-20 px-2 py-1 border rounded text-sm disabled:opacity-50"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  ₹{item.rate}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  ₹{itemTotal.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tracking Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={returnTrackingNo}
                        onChange={(e) => setReturnTrackingNo(e.target.value)}
                        placeholder="Enter tracking number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Return Reason (Optional)
                      </label>
                      <textarea
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        placeholder="Enter reason for return"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span className="text-gray-700">Total Amount:</span>
                        <span className="text-gray-900">
                          ₹{calculateSelectedTotal().toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No items found for this quotation
                </div>
              )}

              <div className="flex gap-4 justify-end pt-4 border-t">
                <button
                  onClick={() => setShowPartialModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={processingReturn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPartialReturn}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-50"
                  disabled={processingReturn || Object.keys(selectedItems).length === 0}
                >
                  {processingReturn ? 'Processing...' : 'Submit Partial Return'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Return Modal */}
      {showFullModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-red-700">Full Return</h2>
              <button
                onClick={() => setShowFullModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {selectedInstallation && (
                <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                  <h3 className="font-semibold text-red-900 mb-2">Order Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Order ID:</span>{' '}
                      <span className="font-medium">#{selectedInstallation.order_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Quotation:</span>{' '}
                      <span className="font-medium">
                        {selectedInstallation.quote_number || `QT-${selectedInstallation.order_id}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Company:</span>{' '}
                      <span className="font-medium">{selectedInstallation.company_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Contact:</span>{' '}
                      <span className="font-medium">{selectedInstallation.contact}</span>
                    </div>
                  </div>
                </div>
              )}

              {quotationItems.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">All Products to Return</h3>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Item Name
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Item Code
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Qty
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Rate
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotationItems.map((item, index) => {
                            const itemTotal = item.rate * item.quantity;
                            return (
                              <tr
                                key={`${item.item_code}-${index}`}
                                className="border-b hover:bg-gray-50 bg-red-50"
                              >
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {item.item_name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.item_code}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  ₹{item.rate}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  ₹{itemTotal.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tracking Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={returnTrackingNo}
                        onChange={(e) => setReturnTrackingNo(e.target.value)}
                        placeholder="Enter tracking number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Return Reason (Optional)
                      </label>
                      <textarea
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        placeholder="Enter reason for return"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>

                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span className="text-red-700">Total Amount:</span>
                        <span className="text-red-900">
                          ₹{quotationItems.reduce((sum, item) => sum + (item.rate * item.quantity), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No items found for this quotation
                </div>
              )}

              <div className="flex gap-4 justify-end pt-4 border-t">
                <button
                  onClick={() => setShowFullModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={processingReturn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFullReturn}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                  disabled={processingReturn}
                >
                  {processingReturn ? 'Processing...' : 'Confirm Full Return'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse In Modal */}
      {showWarehouseInModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-blue-700">Warehouse In</h2>
              <button
                onClick={() => setShowWarehouseInModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Return Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Return ID:</span>{' '}
                    <span className="font-medium">#{selectedReturn.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Quotation No:</span>{' '}
                    <span className="font-medium">{selectedReturn.quotation_no}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Invoice No:</span>{' '}
                    <span className="font-medium">{selectedReturn.invoice_no}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Return Type:</span>{' '}
                    <span className="font-medium">{selectedReturn.return_type === 'full' ? 'Full Return' : 'Partial Return'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Status:</span>{' '}
                    <span className="font-medium">{selectedReturn.return_status}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Godown / Warehouse Location
                  </label>
                  <select
                    value={warehouseGodown}
                    onChange={(e) => setWarehouseGodown(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Delhi - Mundka">Delhi - Mundka</option>
                    <option value="South">South</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Return Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setReturnImage(e.target.files[0]);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {returnImage && (
                    <p className="text-sm text-green-600 mt-1">
                      Selected file: {returnImage.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t">
                <button
                  onClick={() => setShowWarehouseInModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={processingWarehouseIn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitWarehouseIn}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                  disabled={processingWarehouseIn || !returnImage}
                >
                  {processingWarehouseIn ? 'Processing...' : 'Confirm Warehouse In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReturnProductsPage;
