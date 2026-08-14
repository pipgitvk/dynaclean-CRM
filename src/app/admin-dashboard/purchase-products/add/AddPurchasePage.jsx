"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Save,
  Plus,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  File,
  ArrowLeft,
  Calculator,
  Edit3,
  Settings,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import TermsConditionsModal from "../../../../components/TermsConditionsModal";

const stateOfSupplyOptions = [
  "Select", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
  "Jammu and Kashmir", "Ladakh",
];

const unitOptions = ["NONE", "PCS", "BOX", "KG", "LTR", "MTR", "DOZEN", "PACK"];
const priceTypeOptions = ["Without Tax", "With Tax"];
const taxOptions = ["Select", "0%", "5%", "12%", "18%", "28%", "IGST 5%", "IGST 12%", "IGST 18%", "IGST 28%"];
const paymentTypeOptions = ["Cash", "Bank Transfer", "Cheque", "UPI", "Credit Card", "Net Banking"];
const defaultTransportOptions = ["Self", "Courier", "Porter", "Truck"];
const termsTitleOptions = [
  "advance payment terms", "net 30 days", "net 60 days", "net 15 days",
  "payment on delivery", "half advance",
];  

const partiesList = [
  { name: "PIP Trade", balance: "106/3038", phone: "9876543210" },
  { name: "test party", balance: "1416", phone: "9876543211" },
  { name: "test party 2", balance: "1335/71", phone: "9876543212" },
];

// Customer search component
function CustomerSearchDropdown({ value, onChange, onPhoneChange, onCustomerSelect, onStateChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Update search term when value prop changes
  useEffect(() => {
    setSearchTerm(value || "");
  }, [value]);

  // Debounced search function  
  const searchCustomers = async (term) => {
    try {
      setLoading(true);
      // Show some results even for empty or short terms
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(term)}&limit=10`, {
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        setCustomers(result.data);
      } else {
        console.error("Search failed:", result.error);
        setCustomers([]);
      }
    } catch (error) {
      console.error("Error searching customers:", error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchTerm.length >= 0) { // Search even for empty term to show recent customers
        searchCustomers(searchTerm);
      } else {
        setCustomers([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const handleSelectCustomer = (customer) => {
    // If customer has company, use company name as party name, else use customer name
    const partyName = customer.company || customer.customer_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    onChange(partyName);
    onPhoneChange(customer.phone || "");
    onCustomerSelect(customer);
    onStateChange(customer.state || ""); // Set state automatically
    setSearchTerm(partyName);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    onChange(term);
    if (!term) {
      onPhoneChange("");
      onCustomerSelect(null);
      onStateChange(""); // Clear state when input is cleared
    }
    setIsOpen(true);
  };

  const handleFocus = () => {
    setIsOpen(true);
    // Load some customers on focus if search term is empty
    if (searchTerm.length === 0) {
      searchCustomers("");
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder="Search customer by name, phone, email..."
        className="w-52 border-2 border-blue-500 rounded px-3 py-1.5 text-sm bg-white focus:outline-none"
      />
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Searching customers...
            </div>
          )}
          
          {!loading && customers.length === 0 && searchTerm.length > 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No customers found for "{searchTerm}"
            </div>
          )}
          
          {!loading && customers.length === 0 && searchTerm.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Start typing to search customers...
            </div>
          )}
          
          {!loading && customers.map((customer) => (
            <div
              key={customer.customer_id}
              onClick={() => handleSelectCustomer(customer)}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-sm text-gray-800">
                {customer.customer_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ID: {customer.customer_id} | Phone: {customer.phone} | Email: {customer.email || 'N/A'}
              </div>
              {customer.company && (
                <div className="text-xs text-gray-400">
                  Company: {customer.company}
                </div>
              )}
              {customer.state && (
                <div className="text-xs text-gray-400">
                  State: {customer.state}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {isOpen && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Product search component for ITEM column
function ProductSearchDropdown({ value, onChange, onSelect, rowId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  // Update search term when value prop changes
  useEffect(() => {
    setSearchTerm(value || "");
  }, [value]);

  // Calculate dropdown position
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      setDropdownPosition({
        top: rect.bottom + scrollTop + 2,
        left: rect.left + scrollLeft,
        width: rect.width
      });
    }
  };

  // Debounced search function
  const searchProducts = async (term) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products-spares/search?q=${encodeURIComponent(term)}&limit=10`, {
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        setProducts(result.data);
      } else {
        console.error("Search failed:", result.error);
        setProducts([]);
      }
    } catch (error) {
      console.error("Error searching products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchTerm.length >= 0) {
        searchProducts(searchTerm);
      } else {
        setProducts([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const handleSelectProduct = (product) => {
    onChange(product.name);
    onSelect && onSelect(product);
    setSearchTerm(product.name);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    onChange(term);
    if (!term) {
      onSelect && onSelect(null);
    }
    setIsOpen(true);
    updateDropdownPosition();
  };

  const handleFocus = () => {
    setIsOpen(true);
    updateDropdownPosition();
    if (searchTerm.length === 0) {
      searchProducts("");
    }
  };

  return (
    <>
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search products/spares..."
          className="w-full border border-transparent hover:border-gray-200 focus:border-blue-300 px-2 py-1.5 text-sm focus:outline-none"
        />
      </div>
      
      {/* Portal dropdown outside container */}
      {isOpen && (
        <div 
          className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
        >
          {loading && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Searching...
            </div>
          )}
          
          {!loading && products.length === 0 && searchTerm.length > 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No products/spares found for "{searchTerm}"
            </div>
          )}
          
          {!loading && products.length === 0 && searchTerm.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Start typing to search products and spares...
            </div>
          )}
          
          {!loading && products.map((product) => (
            <div
              key={`${product.type}-${product.id}`}
              onClick={() => handleSelectProduct(product)}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-sm text-gray-800">
                {product.name}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Type: {product.type === 'product' ? 'Product' : 'Spare'} | ID: {product.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const todayDisplay = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const fmtINR = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function emptyRow(id) {
  return {
    id,
    item: "",
    product_code: "",
    qty: "",
    unit: "NONE",
    priceType: "Without Tax",
    priceUnit: "",
    taxPerc: "Select",
    taxAmt: "",
    amount: "",
    // per-row document uploads
    product_image: "",
    eway_bill: "",
    invoice_upload: "",
    payment_proof_upload: "",
    quotation_upload: "",
    // per-row upload in-progress flags
    _uploading_product_image: false,
    _uploading_eway_bill: false,
    _uploading_invoice_upload: false,
    _uploading_payment_proof_upload: false,
    _uploading_quotation_upload: false,
  };
}

export default function   AddPurchasePage() {
  const router = useRouter();
  
  // URL parameter handling for edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  const [party, setParty] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(todayDisplay());
  const [stateOfSupply, setStateOfSupply] = useState("");

  const [rows, setRows] = useState([emptyRow(1), emptyRow(2)]);

  const [termsId, setTermsId] = useState(null);
  const [termsTitle, setTermsTitle] = useState("");
  const [termsText, setTermsText] = useState("");

  const [paymentEntries, setPaymentEntries] = useState([
    { id: 1, type: "Cash", amount: "" }
  ]);

  // Stock request data for dropdown
  const [stockRequestData, setStockRequestData] = useState([]);
  const [loadingStockRequests, setLoadingStockRequests] = useState(false);
  
  // Linked statements data
  const [linkedStatements, setLinkedStatements] = useState([]);
  const [loadingLinkedStatements, setLoadingLinkedStatements] = useState(false);

  // Payment management functions
  const addPaymentEntry = () => {
    const newId = Math.max(0, ...paymentEntries.map(p => p.id)) + 1;
    setPaymentEntries(prev => [...prev, { id: newId, type: "Cash", amount: "" }]);
  };

  const removePaymentEntry = (id) => {
    if (paymentEntries.length > 1) {
      setPaymentEntries(prev => prev.filter(p => p.id !== id));
    }
  };

  const updatePaymentEntry = (id, field, value) => {
    setPaymentEntries(prev => 
      prev.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };

  // Calculate total payment amount
  const totalPaymentAmount = paymentEntries.reduce((sum, payment) => {
    return sum + (Number(payment.amount) || 0);
  }, 0);
  const [roundOff, setRoundOff] = useState(true);
  const [roundOffAmount, setRoundOffAmount] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  // Delivery & Transport fields
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [modeOfTransport, setModeOfTransport] = useState("");
  const [transportationCharges, setTransportationCharges] = useState("");
  const [selfName, setSelfName] = useState("");
  const [courierTrackingId, setCourierTrackingId] = useState("");
  const [courierCompany, setCourierCompany] = useState("");
  const [porterTrackingId, setPorterTrackingId] = useState("");
  const [porterContact, setPorterContact] = useState("");
  const [truckNumber, setTruckNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverNumber, setDriverNumber] = useState("");

  // Global document uploads - applied to all product rows
  const [globalDocs, setGlobalDocs] = useState({
    product_image: "",
    eway_bill: "",
    invoice_upload: "",
    payment_proof_upload: "",
    quotation_upload: "",
  });
  const [globalUploading, setGlobalUploading] = useState({
    product_image: false,
    eway_bill: false,
    invoice_upload: false,
    payment_proof_upload: false,
    quotation_upload: false,
  });

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Terms & Conditions Modal State
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [savedTermsList, setSavedTermsList] = useState([]);
  const [termsApplicable, setTermsApplicable] = useState({
    saleInvoice: false,
    saleOrder: false,
    deliveryChallan: false,
    estimationQuotation: false,
    purchaseBill: true,
    purchaseOrder: false,
    proformaInvoice: false
  });

  // Handle URL parameters for edit mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get('edit');
    const invoiceParam = params.get('invoice');

    if (editParam && invoiceParam) {
      setIsEditMode(true);
      setBillNumber(decodeURIComponent(invoiceParam));
      
      // Fetch all products with the same invoice number
      fetchProductsByInvoice(decodeURIComponent(invoiceParam));
    }

    // Fetch saved terms
    fetchSavedTerms();
  }, []);

  // Fetch saved terms from API
  const fetchSavedTerms = async () => {
    try {
      const response = await fetch("/api/terms-conditions", {
        credentials: "include"
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        setSavedTermsList(result.data);
      }
    } catch (error) {
      console.error("Error fetching saved terms:", error);
    }
  };

  // Fetch linked statements for a purchase
  const fetchLinkedStatements = async (purchaseId) => {
    try {
      setLoadingLinkedStatements(true);
      const response = await fetch(`/api/purchase-statements/${purchaseId}`, {
        credentials: "include"
      });
      const result = await response.json();
      
      if (result.success && result.statements && result.statements.length > 0) {
        setLinkedStatements(result.statements);
        // Don't auto-populate, let user select from dropdown
      } else {
        setLinkedStatements([]);
      }
    } catch (error) {
      console.error("Error fetching linked statements:", error);
      setLinkedStatements([]);
    } finally {
      setLoadingLinkedStatements(false);
    }
  };

  // Fetch linked statements for multiple purchases (invoice with multiple products)
  const fetchAllLinkedStatements = async (purchaseIds) => {
    try {
      setLoadingLinkedStatements(true);
      
      // Fetch statements for all purchase IDs
      const promises = purchaseIds.map(id => 
        fetch(`/api/purchase-statements/${id}`, { credentials: "include" })
          .then(res => res.json())
      );
      
      const results = await Promise.all(promises);
      
      // Combine all statements from all purchases
      let allStatements = [];
      results.forEach(result => {
        if (result.success && result.statements && result.statements.length > 0) {
          allStatements = [...allStatements, ...result.statements];
        }
      });
      
      // Remove duplicates based on trans_id
      const uniqueStatements = allStatements.filter((stmt, index, arr) => 
        arr.findIndex(s => s.trans_id === stmt.trans_id) === index
      );
      
      setLinkedStatements(uniqueStatements);
      
      // Don't auto-populate payment entries, let user select from dropdown
      // Keep the existing payment entries structure
      
    } catch (error) {
      console.error("Error fetching all linked statements:", error);
      setLinkedStatements([]);
    } finally {
      setLoadingLinkedStatements(false);
    }
  };

  // Function to fetch all products by invoice number
  const fetchProductsByInvoice = async (invoiceNumber) => {
    try {
      const response = await fetch(`/api/purchase-products/by-invoice/${encodeURIComponent(invoiceNumber)}`, {
        credentials: "include",
      });
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        const products = result.data;
        
        // Use the first product for common fields
        const firstProduct = products[0];
        setParty(firstProduct.vendor_name || "");
        
        // Set edit ID for fetching linked statements
        setEditId(firstProduct.id);
        
        // Fetch linked statements for ALL products of this invoice
        // Collect all purchase IDs first
        const allPurchaseIds = products.map(p => p.id).filter(Boolean);
        if (allPurchaseIds.length > 0) {
          fetchAllLinkedStatements(allPurchaseIds);
        }
        
        // Set customer details if available
        if (firstProduct.customer_id) {
          setSelectedCustomer({
            customer_id: firstProduct.customer_id,
            first_name: firstProduct.client_name?.split(' ')[0] || '',
            last_name: firstProduct.client_name?.split(' ').slice(1).join(' ') || '',
            company: firstProduct.client_company_name,
            phone: firstProduct.client_number,
            email: firstProduct.client_email,
            gstin: firstProduct.client_gstin,
            address: firstProduct.customer_address
          });
          // If company name exists, use it as party name, else use client name
          setParty(firstProduct.client_company_name || firstProduct.client_name || firstProduct.vendor_name || "");
          setPhoneNo(firstProduct.client_number || "");
        } else {
          // If no customer details, use vendor name as party
          setParty(firstProduct.vendor_name || "");
        }
        
        // Convert date format if available
        if (firstProduct.purchase_date) {
          const apiDate = new Date(firstProduct.purchase_date);
          if (!isNaN(apiDate.getTime())) {
            const dd = String(apiDate.getDate()).padStart(2, "0");
            const mm = String(apiDate.getMonth() + 1).padStart(2, "0");
            const yyyy = apiDate.getFullYear();
            setBillDate(`${dd}/${mm}/${yyyy}`);
          }
        }

        // Pre-populate Terms & Conditions if available
        if (firstProduct.terms_id) {
          setTermsId(firstProduct.terms_id);
          setTermsTitle(firstProduct.terms_title || "");
          setTermsText(firstProduct.terms_text || "");
          if (firstProduct.terms_applicable_for) {
            try {
              setTermsApplicable(JSON.parse(firstProduct.terms_applicable_for));
            } catch {
              // Keep default if parsing fails
            }
          }
        }

        // Pre-populate Delivery & Transport fields
        setDeliveryLocation(firstProduct.delivery_location || "");
        setModeOfTransport(firstProduct.mode_of_transport || "");
        setTransportationCharges(firstProduct.transportation_charges != null ? String(firstProduct.transportation_charges) : "");
        setSelfName(firstProduct.self_name || "");
        setCourierTrackingId(firstProduct.courier_tracking_id || "");
        setCourierCompany(firstProduct.courier_company || "");
        setPorterTrackingId(firstProduct.porter_tracking_id || "");
        setPorterContact(firstProduct.porter_contact || "");
        setTruckNumber(firstProduct.truck_number || "");
        setDriverName(firstProduct.driver_name || "");
        setDriverNumber(firstProduct.driver_number || "");
        
        // Pre-populate Global Document Uploads from first product (since all rows share docs)
        setGlobalDocs({
          product_image: firstProduct.product_image || "",
          eway_bill: firstProduct.eway_bill || "",
          invoice_upload: firstProduct.invoice_upload || "",
          payment_proof_upload: firstProduct.payment_proof_upload || "",
          quotation_upload: firstProduct.quotation_upload || "",
        });
        
        // Pre-populate Payment Entries if available
        if (firstProduct.payment_entries) {
          try {
            const loadedPaymentEntries = JSON.parse(firstProduct.payment_entries);
            if (Array.isArray(loadedPaymentEntries) && loadedPaymentEntries.length > 0) {
              setPaymentEntries(loadedPaymentEntries);
            }
          } catch (error) {
            console.error("Error parsing payment entries:", error);
          }
        }
        
        // Convert all products to rows
        const newRows = products.map((product, index) => {
          const qty = Number(product.quantity) || 1;
          const unitPrice = Number(product.unit_price) || 0;
          const gstAmount = Number(product.gst_amount) || 0;
          const amount = Number(product.amount) || 0;
          
          // Calculate tax percentage from GST amount and base price
          let taxPerc = "18%";
          const basePrice = qty * unitPrice;
          if (gstAmount > 0 && basePrice > 0) {
            const taxPercNum = Math.round((gstAmount / basePrice) * 100);
            taxPerc = `${taxPercNum}%`;
          }
          
          return {
            id: index + 1,
            item: product.product_name || "",
            product_code: product.product_code || "", // Add product_code from database
            qty: String(qty),
            unit: "PCS",
            priceType: (taxPerc === "Select" || !taxPerc || gstAmount <= 0) ? "Without Tax" : "With Tax",
            priceUnit: String(unitPrice),
            taxPerc: gstAmount > 0 ? taxPerc : "Select",
            taxAmt: gstAmount ? gstAmount.toFixed(2) : "",
            amount: amount ? amount.toFixed(2) : "",
            originalId: product.id, // Store original ID for updates
            product_image: product.product_image || "",
            eway_bill: product.eway_bill || "",
            invoice_upload: product.invoice_upload || "",
            payment_proof_upload: product.payment_proof_upload || "",
            quotation_upload: product.quotation_upload || "",
            _uploading_product_image: false,
            _uploading_eway_bill: false,
            _uploading_invoice_upload: false,
            _uploading_payment_proof_upload: false,
            _uploading_quotation_upload: false,
          };
        });
        
        setRows(newRows);
        
        // Calculate total amount
        const total = products.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        setTotalAmount(total.toFixed(2));
        
        toast.success(`Loaded ${products.length} product${products.length > 1 ? "s" : ""} from invoice ${invoiceNumber}`);
      } else {
        toast.error("No products found for this invoice");
      }
    } catch (error) {
      console.error("Error fetching products by invoice:", error);
      toast.error("Failed to load products");
    }
  };

  const addRow = () => {
    setRows((prev) => {
      const newId = Math.max(0, ...prev.map((r) => r.id)) + 1;
      const newRowData = emptyRow(newId);
      // Apply any existing global document uploads to the new row
      return [...prev, { ...newRowData, ...globalDocs }];
    });
  };

  const removeRow = (id) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateRow = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === "taxPerc") {
          if (value === "Select" || !value) {
            updated.priceType = "Without Tax";
          } else {
            updated.priceType = "With Tax";
          }
        }
        const qty = Number(updated.qty) || 0;
        const price = Number(updated.priceUnit) || 0;
        const gross = qty * price;
        
        // No discount calculation
        const afterDisc = gross;
        let taxAmt = 0;
        const taxPercStr = String(updated.taxPerc || "").replace(/[^0-9.]/g, "");
        const taxPercNum = Number(taxPercStr) || 0;
        if (taxPercNum > 0) taxAmt = afterDisc * (taxPercNum / 100);
        
        updated.taxAmt = taxAmt ? taxAmt.toFixed(2) : "";
        updated.amount = afterDisc + taxAmt ? (afterDisc + taxAmt).toFixed(2) : "";
        return updated;
      })
    );
  };

  const totals = rows.reduce(
    (acc, r) => {
      acc.qty += Number(r.qty) || 0;
      acc.taxAmt += Number(r.taxAmt) || 0;
      acc.amount += Number(r.amount) || 0;
      return acc;
    },
    { qty: 0, taxAmt: 0, amount: 0 }
  );

  const grandTotal = Number(totalAmount) || totals.amount || 0;

  const handleBillUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append("bill", file);

      const response = await fetch("/api/upload-bill", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process bill");
      }

      if (result.success && result.data.parsedData) {
        const { parsedData } = result.data;
        
        // Auto-fill form fields
        if (parsedData.invoiceNo) {
          setBillNumber(parsedData.invoiceNo);
        }
        
        if (parsedData.vendor) {
          // Set vendor name for search, the component will handle matching
          setParty(parsedData.vendor);
        }
        
        if (parsedData.phone) {
          setPhoneNo(parsedData.phone);
        }
        
        if (parsedData.date) {
          // Convert date format if needed
          setBillDate(parsedData.date);
        }
        
        if (parsedData.totalAmount) {
          setTotalAmount(parsedData.totalAmount);
        }
        
        if (parsedData.state) {
          setStateOfSupply(parsedData.state);
        }
        
        // Auto-fill items if found
        if (parsedData.items && parsedData.items.length > 0) {
          // Create new rows based on parsed items
          const newRows = parsedData.items.map((item, index) => {
            const qty = Number(item.qty) || 0;
            const price = Number(item.priceUnit) || 0;
            const gross = qty * price;
            
            // Calculate tax amount
            let taxAmt = 0;
            const taxPercStr = String(item.taxPerc || "18%").replace(/[^0-9.]/g, "");
            const taxPercNum = Number(taxPercStr) || 0;
            if (taxPercNum > 0) {
              taxAmt = gross * (taxPercNum / 100);
            }
            
            const finalAmount = gross + taxAmt;
            
            return {
              id: index + 1,
              item: item.item || "",
              product_code: item.product_code || "", // Add product_code from parsed data
              qty: String(qty),
              unit: item.unit || "PCS",
              priceType: item.priceType || "With Tax",
              priceUnit: String(price),
              taxPerc: item.taxPerc || "18%",
              taxAmt: taxAmt ? taxAmt.toFixed(2) : "",
              amount: finalAmount ? finalAmount.toFixed(2) : "",
            };
          });
          
          // Don't enforce minimum 2 rows - let it be dynamic based on parsed data
          setRows(newRows);
        }
        
        toast.success("Bill uploaded and fields auto-filled successfully!");
      }
      
    } catch (error) {
      console.error("Error uploading bill:", error);
      toast.error(error.message || "Error processing bill upload");
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  // Upload a document for a specific row and field
  const handleRowDocUpload = async (rowId, fieldName, file) => {
    if (!file) return;
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [`_uploading_${fieldName}`]: true } : r));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fieldName", fieldName);
      const res = await fetch("/api/upload-purchase-docs", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Upload failed");
      setRows((prev) => prev.map((r) =>
        r.id === rowId ? { ...r, [fieldName]: result.data.url, [`_uploading_${fieldName}`]: false } : r
      ));
      toast.success("Uploaded");
    } catch (err) {
      setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [`_uploading_${fieldName}`]: false } : r));
      toast.error(err.message || "Upload failed");
    }
  };

  // Upload a global document - applied to ALL product rows
  const handleGlobalDocUpload = async (fieldName, file) => {
    if (!file) return;
    setGlobalUploading((prev) => ({ ...prev, [fieldName]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fieldName", fieldName);
      const res = await fetch("/api/upload-purchase-docs", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Upload failed");
      const url = result.data.url;
      // Update global state
      setGlobalDocs((prev) => ({ ...prev, [fieldName]: url }));
      // Apply same URL to ALL rows
      setRows((prev) => prev.map((r) => ({ ...r, [fieldName]: url })));
      toast.success("Document uploaded & applied to all products");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setGlobalUploading((prev) => ({ ...prev, [fieldName]: false }));
    }
  };

  const handleSave = async () => {
    // Prevent multiple submissions
    if (saving) {
      return;
    }
    
    try {
      setSaving(true);
      
      // Create separate entries for each row with items
      const itemRows = rows.filter(row => row.item && row.item.trim());
      
      if (itemRows.length === 0) {
        toast.error("Please add at least one item");
        return;
      }
      
      if (!party || !billNumber) {
        toast.error("Please fill Party and Bill Number");
        return;
      }

      if (!deliveryLocation || !deliveryLocation.trim()) {
        toast.error("Delivery Location is required");
        return;
      }

      if (!modeOfTransport) {
        toast.error("Mode of Transport is required");
        return;
      }

      if (modeOfTransport === "Self" && !selfName.trim()) {
        toast.error("Name is required for Self transport");
        return;
      }

      if (modeOfTransport === "Courier") {
        if (!courierTrackingId.trim()) {
          toast.error("Tracking ID is required for Courier");
          return;
        }
        if (!courierCompany.trim()) {
          toast.error("Courier Company is required for Courier");
          return;
        }
      }

      if (modeOfTransport === "Porter" && !porterTrackingId.trim()) {
        toast.error("Tracking ID is required for Porter");
        return;
      }

      if (modeOfTransport === "Truck") {
        if (!truckNumber.trim()) {
          toast.error("Truck Number is required for Truck");
          return;
        }
        if (!driverName.trim()) {
          toast.error("Driver Name is required for Truck");
          return;
        }
        if (!driverNumber.trim()) {
          toast.error("Driver Number is required for Truck");
          return;
        }
      }
      
      if (isEditMode) {
        // Update mode - update all existing products and create new ones
        const promises = itemRows.map(async (row, index) => {
          const productData = {
            invoice_no: billNumber,
            vendor_name: selectedCustomer?.company || party, // Use company name as vendor
            product_name: row.item,
            product_code: row.product_code || "", // Include product_code
            amount: row.amount || "0",
            status: "Unpaid",
            purchase_date: new Date().toISOString().split("T")[0],
            reference_no: "",
            quantity: row.qty || "1",
            unit_price: row.priceUnit || "0",
            gst_amount: row.taxAmt || "0",
            notes: termsText,
            payment_entries: JSON.stringify(paymentEntries), // Save payment entries
            terms_id: termsId,
            // Delivery & Transport
            delivery_location: deliveryLocation || null,
            mode_of_transport: modeOfTransport || null,
            transportation_charges: transportationCharges ? Number(transportationCharges) : 0,
            self_name: selfName || null,
            courier_tracking_id: courierTrackingId || null,
            courier_company: courierCompany || null,
            porter_tracking_id: porterTrackingId || null,
            porter_contact: porterContact || null,
            truck_number: truckNumber || null,
            driver_name: driverName || null,
            driver_number: driverNumber || null,
            // Customer details
            customer_id: selectedCustomer?.customer_id || null,
            client_name: selectedCustomer ? `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() : party,
            client_company_name: selectedCustomer?.company || party, // Company name
            client_number: phoneNo,
            client_email: selectedCustomer?.email || "",
            client_gstin: selectedCustomer?.gstin || "",
            customer_address: selectedCustomer?.address || "",
            // Document uploads - use global docs applied to all rows
            eway_bill: globalDocs.eway_bill || null,
            product_image: globalDocs.product_image || null,
            invoice_upload: globalDocs.invoice_upload || null,
            payment_proof_upload: globalDocs.payment_proof_upload || null,
            quotation_upload: globalDocs.quotation_upload || null,
          };

          if (row.originalId) {
            // Update existing product
            const res = await fetch(`/api/purchase-products/${row.originalId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(productData),
            });
            return res.json();
          } else {
            // Create new product (if user added more items)
            const res = await fetch("/api/purchase-products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(productData),
            });
            return res.json();
          }
        });
        
        const results = await Promise.all(promises);
        const failedResults = results.filter(result => !result.success);
        
        if (failedResults.length > 0) {
          throw new Error(failedResults[0].error || "Failed to update some products");
        }
        
        toast.success(`${itemRows.length} products updated successfully`);
      } else {
        // Create mode - create new purchase entries for each item
        const promises = itemRows.map(async (row, index) => {
          const res = await fetch("/api/purchase-products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              invoice_no: billNumber,
              vendor_name: selectedCustomer?.company || party, // Use company name as vendor
              product_name: row.item,
              product_code: row.product_code || "", // Include product_code
              amount: row.amount || "0",
              status: "Unpaid",
              purchase_date: new Date().toISOString().split("T")[0],
              reference_no: "",
              quantity: row.qty || "1",
              unit_price: row.priceUnit || "0",
              gst_amount: row.taxAmt || "0",
              notes: termsText,
              payment_entries: JSON.stringify(paymentEntries), // Save payment entries
              terms_id: termsId,
              // Delivery & Transport
              delivery_location: deliveryLocation || null,
              mode_of_transport: modeOfTransport || null,
              transportation_charges: transportationCharges ? Number(transportationCharges) : 0,
              self_name: selfName || null,
              courier_tracking_id: courierTrackingId || null,
              courier_company: courierCompany || null,
              porter_tracking_id: porterTrackingId || null,
              porter_contact: porterContact || null,
              truck_number: truckNumber || null,
              driver_name: driverName || null,
              driver_number: driverNumber || null,
              // Customer details
              customer_id: selectedCustomer?.customer_id || null,
              client_name: selectedCustomer ? `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() : party,
              client_company_name: selectedCustomer?.company || party, // Company name
              client_number: phoneNo,
              client_email: selectedCustomer?.email || "",
              client_gstin: selectedCustomer?.gstin || "",
              customer_address: selectedCustomer?.address || "",
              // Document uploads - use global docs applied to all rows
              eway_bill: globalDocs.eway_bill || null,
              product_image: globalDocs.product_image || null,
              invoice_upload: globalDocs.invoice_upload || null,
              payment_proof_upload: globalDocs.payment_proof_upload || null,
              quotation_upload: globalDocs.quotation_upload || null,
            }),
          });
          return res.json();
        });
        
        const results = await Promise.all(promises);
        const failedResults = results.filter(result => !result.success);
        
        if (failedResults.length > 0) {
          throw new Error(failedResults[0].error || "Failed to save some items");
        }
        
        toast.success(`${itemRows.length} items saved successfully`);
      }
      
      router.push("/admin-dashboard/purchase-products");
    } catch (e) {
      toast.error(e.message || `Error ${isEditMode ? 'updating' : 'saving'} purchase`);
    } finally {
      setSaving(false);
    }
  };

// Handle Terms & Conditions Save
  const handleTermsSave = (termsData) => {
    setTermsId(termsData.id || null);
    setTermsTitle(termsData.title);
    setTermsText(termsData.terms_text);
    setTermsApplicable(JSON.parse(termsData.applicable_for || "{}"));
    toast.success("Terms & Conditions applied successfully!");
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] w-full">
      <div className="w-full px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Link
            href="/admin-dashboard/purchase-products"
            className="text-blue-600 text-sm hover:underline"
          >
            <ArrowLeft size={14} className="inline mr-1" /> Back
          </Link>
        </div>

        <div className="bg-white border border-gray-300 rounded-sm mb-4">
          <div className="px-5 py-3 border-b border-gray-200">
            <h1 className="text-lg font-bold text-gray-800">
              {isEditMode ? "Edit Purchase" : "Purchase"}
            </h1>
          </div>

          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <label className="block text-xs text-gray-600 mb-1">
                    Party<span className="text-red-500">*</span>
                  </label>
                  <CustomerSearchDropdown
                    value={party}
                    onChange={setParty}
                    onPhoneChange={setPhoneNo}
                    onCustomerSelect={setSelectedCustomer}
                    onStateChange={setStateOfSupply}
                  />

                  <button
                    type="button"
                    onClick={() => window.open('/admin-dashboard/add-customer', '_blank')}
                    className="flex items-center gap-1 text-xs text-blue-600 mt-1 hover:underline"
                  >
                    <Plus size={12} /> Add Party
                  </button>

                  {selectedCustomer && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500">ID:</span>
                        <span className="text-xs font-semibold text-gray-700">{selectedCustomer.customer_id}</span>
                      </div>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => toast("Edit customer coming soon")}
                        title="Edit customer"
                      >
                        <Edit3 size={11} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Phone No.</label>
                  <input
                    type="text"
                    value={phoneNo}
                    onChange={(e) => setPhoneNo(e.target.value)}
                    placeholder=""
                    className="w-40 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="text-right">
                  <label className="block text-xs text-gray-500 mb-1">Bill Number</label>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-40 border-b border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="text-right">
                  <label className="block text-xs text-gray-500 mb-1">Bill Date</label>
                  <div className="flex items-center gap-2 justify-end">
                    <input
                      type="text"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      className="text-blue-600 hover:text-blue-700"
                      onClick={() => {
                        const inp = document.createElement("input");
                        inp.type = "date";
                        inp.style.position = "absolute";
                        inp.style.opacity = "0";
                        document.body.appendChild(inp);
                        inp.click();
                        inp.onchange = () => {
                          if (inp.value) {
                            const [y, m, d] = inp.value.split("-");
                            setBillDate(`${d}/${m}/${y}`);
                          }
                          document.body.removeChild(inp);
                        };
                      }}
                    >
                      <Calculator size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <label className="block text-xs text-gray-500 mb-1">State of supply</label>
                  <div className="relative">
                    <select
                      value={stateOfSupply}
                      onChange={(e) => setStateOfSupply(e.target.value)}
                      className="w-40 appearance-none border-b border-gray-300 px-2 py-1 text-sm text-right bg-transparent focus:outline-none focus:border-blue-400"
                    >
                      {stateOfSupplyOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-0 top-[7px] text-gray-500 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-gray-300 rounded mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-8 text-xs">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">ITEM</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 w-20 text-xs">QTY</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 w-28 text-xs">UNIT</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 w-44 text-xs">PRICE/UNIT</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 w-28 text-xs">TAX</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 w-20 text-xs"></th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 w-28 text-xs">AMOUNT</th>
                    <th className="w-8 text-center">
                      <button
                        type="button"
                        onClick={addRow}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
                        title="Add Row"
                      >
                        <Plus size={14} />
                      </button>
                    </th>
                  </tr>
                  <tr className="bg-[#fafafa] border-b border-gray-200 text-gray-500">
                    <th colSpan={5}></th>
                    <th className="px-2 py-1 text-center font-medium text-[10px] border-l border-gray-200"></th>
                    <th className="px-2 py-1 text-center font-medium text-[10px] border-r border-gray-200">AMOUNT</th>
                    <th colSpan={2}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-100 ${
                        idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-600 text-xs">{idx + 1}</td>
                      <td className="px-3 py-1.5">
                        <ProductSearchDropdown
                          value={row.item}
                          onChange={(value) => updateRow(row.id, "item", value)}
                          onSelect={(product) => {
                            // Auto-fill some defaults when a product is selected
                            if (product) {
                              console.log("Selected product:", product);
                              // Auto-fill product_code when a product is selected
                              updateRow(row.id, "product_code", product.code || "");
                              // You can add more logic here to auto-fill price, unit, etc.
                            }
                          }}
                          rowId={row.id}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                          className="w-full border border-gray-200 px-2 py-1.5 text-sm text-center focus:outline-none focus:border-blue-300"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="relative">
                          <select
                            value={row.unit}
                            onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                            className="w-full appearance-none border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-300"
                          >
                            {unitOptions.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="grid grid-cols-2 gap-1">
                          <div className="relative">
                            <select
                              value={row.priceType}
                              onChange={(e) => updateRow(row.id, "priceType", e.target.value)}
                              className="w-full appearance-none border border-gray-200 bg-white px-1 py-1.5 pr-5 text-[10px] focus:outline-none"
                            >
                              {priceTypeOptions.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                            <ChevronDown size={9} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                          <input
                            type="number"
                            value={row.priceUnit}
                            onChange={(e) => updateRow(row.id, "priceUnit", e.target.value)}
                            className="w-full border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:border-blue-300"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 border-l border-gray-100">
                        <div className="relative">
                          <select
                            value={row.taxPerc}
                            onChange={(e) => updateRow(row.id, "taxPerc", e.target.value)}
                            className="w-full appearance-none border border-gray-200 px-2 py-1.5 pr-7 text-sm focus:outline-none focus:border-blue-300"
                          >
                            {taxOptions.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-100">
                        <input
                          type="text"
                          value={row.taxAmt}
                          readOnly
                          className="w-full border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-right text-gray-600"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="text"
                          value={row.amount}
                          readOnly
                          className="w-full border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-right font-semibold text-gray-700"
                        />
                      </td>
                      <td></td>
                    </tr>
                  ))}

                  <tr className="bg-[#fafafa] border-t-2 border-gray-200">
                    <td colSpan={1} className="px-3 py-3">
                      <button
                        type="button"
                        onClick={addRow}
                        className="px-3 py-1.5 text-xs font-bold border-2 border-blue-500 text-white bg-blue-500 rounded hover:bg-blue-600"
                      >
                        ADD ROW
                      </button>
                    </td>
                    <td colSpan={4} className="px-3 py-3 text-right font-bold text-gray-700 uppercase text-xs tracking-wide">
                      TOTAL
                    </td>
                    <td colSpan={1}></td>
                    <td className="px-2 py-3 text-right font-semibold text-gray-700 border-r border-gray-200">
                      <span className="inline-block min-w-[60px]">{fmtINR(totals.taxAmt)}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-bold text-gray-800 inline-block min-w-[100px]">{fmtINR(totals.amount)}</span>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
              <div className="border border-gray-300 rounded p-4 w-72 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Terms & Conditions</h3>
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                    title="Add/Edit Terms & Conditions"
                  >
                    <Settings size={12} />
                    Configure
                  </button>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <div className="relative">
                    <select
                      value={termsTitle}
                      onChange={(e) => {
                        setTermsTitle(e.target.value);
                        // Auto-fill terms text when title is selected
                        const selectedTerm = savedTermsList.find(t => t.title === e.target.value);
                        if (selectedTerm) {
                          setTermsId(selectedTerm.id || null);
                          setTermsText(selectedTerm.terms_text);
                          setTermsApplicable(JSON.parse(selectedTerm.applicable_for || "{}"));
                        } else {
                          setTermsId(null);
                        }
                      }}
                      className="w-full appearance-none border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
                    >
                      <option value="">-- Select title --</option>
                      {savedTermsList.map((term) => (
                        <option key={term.id} value={term.title}>
                          {term.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <textarea
                    value={termsText}
                    onChange={(e) => setTermsText(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                    placeholder="Enter terms and conditions..."
                  />
                </div>
                
                {/* Display applicable document types */}
                {Object.values(termsApplicable).some(val => val) && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs text-blue-700 font-medium mb-1">Applicable for:</p>
                    <div className="flex flex-wrap gap-1">
                      {termsApplicable.saleInvoice && (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">Sale Invoice</span>
                      )}
                      {termsApplicable.saleOrder && (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">Sale Order</span>
                      )}
                      {termsApplicable.deliveryChallan && (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">Delivery Challan</span>
                      )}
                      {termsApplicable.estimationQuotation && (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">Estimation/Quotation</span>
                      )}
                      {termsApplicable.purchaseBill && (
                        <span className="px-2 py-0.5 text-[10px] bg-green-100 text-green-800 rounded font-medium">Purchase Bill</span>
                      )}
                      {termsApplicable.purchaseOrder && (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">Purchase Order</span>
                      )}
                      {termsApplicable.proformaInvoice && (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">Proforma Invoice</span>
                      )}
                    </div>
                  </div>
                )}

              </div>

              <div className="flex-1 max-w-md">
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-3">Payment Details</label>
                  
                  {/* Show loading indicator for linked statements */}
                  {loadingLinkedStatements && (
                    <div className="mb-3 p-3 border border-blue-200 rounded-md bg-blue-50">
                      <div className="text-sm text-blue-600">Loading linked payment statements...</div>
                    </div>
                  )}
                  
                  {paymentEntries.map((payment, index) => (
                    <div key={payment.id} className={`flex items-center gap-3 mb-3 p-3 border rounded-md ${payment.readonly ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Payment Type</label>
                        <div className="relative">
                          <select
                            value={payment.type}
                            onChange={(e) => !payment.readonly && updatePaymentEntry(payment.id, 'type', e.target.value)}
                            disabled={payment.readonly}
                            className={`w-full appearance-none border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${payment.readonly ? 'bg-green-100 cursor-not-allowed' : 'bg-white'}`}
                          >
                            {payment.readonly ? (
                              <option value={payment.type}>{payment.type}</option>
                            ) : (
                              paymentTypeOptions.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))
                            )}
                          </select>
                          {!payment.readonly && (
                            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                          )}
                        </div>
                        {payment.trans_id && (
                          <div className="text-xs text-green-600 mt-1 font-mono">
                            Trans ID: {payment.trans_id}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Amount</label>
                        {payment.readonly ? (
                          // Show readonly amount with trans_id for linked statements
                          <div className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-green-100 cursor-not-allowed">
                            ₹{Number(payment.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        ) : linkedStatements.length > 0 ? (
                          // Show dropdown with linked trans_ids and amounts
                          <div className="relative">
                            <select
                              value={payment.amount}
                              onChange={(e) => {
                                const selectedValue = e.target.value;
                                updatePaymentEntry(payment.id, 'amount', selectedValue);
                                
                                // Find the selected statement to get trans_id
                                const selectedStatement = linkedStatements.find(stmt => 
                                  String(stmt.amount) === selectedValue
                                );
                                if (selectedStatement) {
                                  updatePaymentEntry(payment.id, 'trans_id', selectedStatement.trans_id);
                                }
                              }}
                              className="w-full appearance-none border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white pr-8"
                            >
                              <option value="">Select Amount</option>
                              {linkedStatements.map((stmt, index) => (  
                                <option key={stmt.id} value={stmt.amount}>
                                  {stmt.trans_id} - ₹{Number(stmt.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                          </div>
                        ) : (
                          // Regular amount input for manual entries
                          <input
                            type="number"
                            placeholder="Enter amount"
                            value={payment.amount}
                            onChange={(e) => updatePaymentEntry(payment.id, 'amount', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
                          />
                        )}
                      </div>
                      
                      {paymentEntries.length > 1 && !payment.readonly && (
                        <button
                          type="button"
                          onClick={() => removePaymentEntry(payment.id)}
                          className="mt-5 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                          title="Delete Payment"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between mt-3">
                    <button
                      type="button"
                      onClick={addPaymentEntry}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Plus size={12} /> 
                      {linkedStatements.length > 0 ? 'Add Manual Payment' : 'Add Payment type'}
                    </button>
                    
                    <div className="text-sm font-semibold text-gray-700">
                      Total payment: ₹{totalPaymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

              </div>

              <div className="w-96">
                <div className="flex items-center justify-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roundOff}
                      onChange={(e) => setRoundOff(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Round Off</span>
                  </label>
                  <input
                    type="number"
                    value={roundOffAmount}
                    onChange={(e) => setRoundOffAmount(e.target.value)}
                    disabled={!roundOff}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400 disabled:bg-gray-100"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700 font-medium">Total</label>
                    <input
                      type="number"
                      value={totalAmount || (totals.amount ? totals.amount.toFixed(2) : "")}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-48 border border-gray-300 rounded px-3 py-1.5 text-sm text-right font-semibold focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Delivery & Transport Section ── */}
            <div className="mb-4 border border-gray-200 rounded p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Delivery & Transport</h3>
              <p className="text-xs text-gray-400 mb-3">These details will be applied to <strong>all product rows</strong>.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Delivery Location<span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    rows={2}
                    placeholder="Enter delivery location/address"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Mode of Transport<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={modeOfTransport}
                      onChange={(e) => {
                        setModeOfTransport(e.target.value);
                        setSelfName("");
                        setCourierTrackingId("");
                        setCourierCompany("");
                        setPorterTrackingId("");
                        setPorterContact("");
                        setTruckNumber("");
                        setDriverName("");
                        setDriverNumber("");
                      }}
                      className="w-full appearance-none border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                      required
                    >
                      <option value="">-- Select --</option>
                      {Array.from(new Set([...defaultTransportOptions, modeOfTransport].filter(Boolean))).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>

                  {/* Conditional fields based on Mode of Transport */}
                  {modeOfTransport === "Self" && (
                    <div className="mt-3">
                      <label className="block text-xs text-gray-600 mb-1">
                        Name<span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={selfName}
                        onChange={(e) => setSelfName(e.target.value)}
                        placeholder="Enter person name"
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                        required
                      />
                    </div>
                  )}

                  {modeOfTransport === "Courier" && (
                    <>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Tracking ID<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={courierTrackingId}
                          onChange={(e) => setCourierTrackingId(e.target.value)}
                          placeholder="Enter courier tracking ID"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                          required
                        />
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Courier Company<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={courierCompany}
                          onChange={(e) => setCourierCompany(e.target.value)}
                          placeholder="Enter courier company name"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                          required
                        />
                      </div>
                    </>
                  )}

                  {modeOfTransport === "Porter" && (
                    <>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Tracking ID<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={porterTrackingId}
                          onChange={(e) => setPorterTrackingId(e.target.value)}
                          placeholder="Enter porter tracking ID"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                          required
                        />
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Porter Contact
                        </label>
                        <input
                          type="text"
                          value={porterContact}
                          onChange={(e) => setPorterContact(e.target.value)}
                          placeholder="Enter porter contact number"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    </>
                  )}

                  {modeOfTransport === "Truck" && (
                    <>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Truck Number<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={truckNumber}
                          onChange={(e) => setTruckNumber(e.target.value)}
                          placeholder="Enter truck number (e.g. MH-12-AB-1234)"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                          required
                        />
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Driver Name<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          placeholder="Enter driver name"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                          required
                        />
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Driver Number<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={driverNumber}
                          onChange={(e) => setDriverNumber(e.target.value)}
                          placeholder="Enter driver contact number"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Transportation Charges
                  </label>
                  <input
                    type="number"
                    value={transportationCharges}
                    onChange={(e) => setTransportationCharges(e.target.value)}
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* ── Document Uploads Section ── */}
            <div className="mb-4 border border-gray-200 rounded p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Document Uploads</h3>
              <p className="text-xs text-gray-400 mb-3">Uploaded documents will be applied to <strong>all product rows</strong>.</p>

              <div className="flex items-center gap-3 flex-wrap py-2">
                {/* 5 upload buttons inline - single row for all products */}
                {[
                  { field: "product_image",        label: "Product Image",   accept: ".jpg,.jpeg,.png,.gif,.webp", required: true,  isImage: true  },
                  { field: "eway_bill",            label: "E-Way Bill",      accept: ".pdf,.jpg,.jpeg,.png",      required: false, isImage: false },
                  { field: "invoice_upload",       label: "Invoice",         accept: ".pdf,.jpg,.jpeg,.png",      required: false, isImage: false },
                  { field: "payment_proof_upload", label: "Payment Proof",   accept: ".pdf,.jpg,.jpeg,.png",      required: false, isImage: false },
                  { field: "quotation_upload",     label: "Quotation",       accept: ".pdf,.jpg,.jpeg,.png",      required: false, isImage: false },
                ].map(({ field, label, accept, required, isImage }) => {
                  const uploading = globalUploading[field];
                  const url = globalDocs[field];
                  return (
                    <div key={field} className="flex flex-col items-start gap-0.5">
                      <span className="text-[10px] text-gray-500">
                        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <label
                          htmlFor={`global-doc-${field}`}
                          className={`flex items-center gap-1 px-2.5 py-1 border rounded text-[11px] cursor-pointer transition
                            ${url ? "border-green-400 bg-green-50 text-green-700 hover:bg-green-100"
                                 : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"}
                            ${uploading ? "opacity-50 cursor-not-allowed" : ""}
                          `}
                        >
                          <Upload size={11} />
                          {uploading ? "…" : url ? "Change" : "Upload"}
                        </label>
                        <input
                          id={`global-doc-${field}`}
                          type="file"
                          accept={accept}
                          disabled={uploading}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleGlobalDocUpload(field, f);
                            e.target.value = "";
                          }}
                        />
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 border border-blue-300 bg-blue-50 text-blue-600 rounded text-[11px] hover:bg-blue-100 transition"
                            title={`View ${label}`}
                          >
                            {isImage ? <ImageIcon size={11} /> : <FileText size={11} />}
                            View
                          </a>
                        )}
                      </div>
                      {/* Thumbnail preview for image files */}
                      {url && isImage && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block overflow-hidden border border-gray-200 rounded hover:border-blue-400 transition"
                        >
                          <img
                            src={url}
                            alt={label}
                            className="w-14 h-14 object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif"
                  onChange={handleBillUpload}
                  className="hidden"
                  id="bill-upload"
                />
                <label
                  htmlFor="bill-upload"
                  className={`flex items-center gap-2 px-4 py-2 border-2 border-blue-500 text-blue-600 rounded hover:bg-blue-50 font-medium text-sm cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Upload size={16} />
                  {uploading ? "Processing..." : "Upload Bill"}
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Supports PDF, JPG, PNG files
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toast("Share coming soon")}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium text-sm"
                  >
                    Share
                    <ChevronDown size={13} className="text-gray-500" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={saving ? null : handleSave}
                  disabled={saving}
                  className={`flex items-center gap-2 px-7 py-2 rounded font-semibold text-sm shadow-sm transition-all ${
                    saving 
                      ? "bg-gray-400 text-gray-700 cursor-not-allowed opacity-60" 
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <Save size={16} />
                  {saving ? (isEditMode ? "Updating..." : "Saving...") : (isEditMode ? "Update" : "Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Terms & Conditions Modal */}
      <TermsConditionsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onSave={handleTermsSave}
        initialTitle={termsTitle}
        initialTerms={termsText}
        applicableFor={termsApplicable}
      />
    </div>
  );
}
