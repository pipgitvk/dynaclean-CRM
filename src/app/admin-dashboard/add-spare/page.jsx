"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Head from "next/head";
import { toast } from "react-hot-toast";

export default function AddSparePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    item_name: "",
    specification: "",
    type: "",
    make: "",
    model: "",
    compatible_machine: [], // Store as an array of product codes
    purchase_price: "",
    sale_price: "",
    last_negotiation_price: "",
    tax: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [catalogFile, setCatalogFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Products dropdown state
  const [products, setProducts] = useState([]);
  const [machineSearch, setMachineSearch] = useState("");
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);

  // Search-first modal state (one-time fetch then client filter)
  const [showSearchModal, setShowSearchModal] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState("");
  const [spareIndex, setSpareIndex] = useState([]);
  const [loadedIndex, setLoadedIndex] = useState(false);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products/list");
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        toast.error("Failed to load products for compatible machines");
      }
    };
    fetchProducts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Filter products based on search input
  const filteredProducts = products.filter((p) => {
    const query = machineSearch.toLowerCase();
    if (!query) return true;
    
    const itemName = String(p.item_name || "").toLowerCase();
    const itemCode = String(p.item_code || "").toLowerCase();
    const productNumber = String(p.product_number || "").toLowerCase();
    
    return itemName.includes(query) || itemCode.includes(query) || productNumber.includes(query);
  });

  // Add machine (product code) to compatible machines
  const addMachine = (product) => {
    const machineId = product.product_number; // Store only product_number
    
    // Check if already added
    if (formData.compatible_machine.includes(machineId)) {
      toast.error("This machine is already added");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      compatible_machine: [...prev.compatible_machine, machineId],
    }));
    setMachineSearch("");
    setShowMachineDropdown(false);
  };

  // Remove machine from compatible machines
  const removeMachine = (machineToRemove) => {
    setFormData((prev) => ({
      ...prev,
      compatible_machine: prev.compatible_machine.filter(
        (machine) => machine !== machineToRemove
      ),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append("item_name", formData.item_name);
    data.append("specification", formData.specification);
    data.append("compatible_machine", formData.compatible_machine.join(",")); // Join array with commas
    data.append("type", formData.type);
    data.append("make", formData.make);
    data.append("model", formData.model);
    data.append("purchase_price", formData.purchase_price);
    data.append("sale_price", formData.sale_price);
    data.append("last_negotiation_price", formData.last_negotiation_price);
    data.append("tax", formData.tax);
    if (imageFile) {
      data.append("image", imageFile);
    }
    if (catalogFile) {
      data.append("catalog", catalogFile);
    }

    try {
      const response = await fetch("/api/spare/add", {
        method: "POST",
        body: data,
      });

      if (response.ok) {
        toast.success("Spare part added successfully! ✅");
        setFormData({
          item_name: "",
          specification: "",
          type: "",
          make: "",
          model: "",
          compatible_machine: [],
          purchase_price: "",
          sale_price: "",
          last_negotiation_price: "",
          tax: "",
        });
        setImageFile(null);
        setCatalogFile(null);
        setNewMachine("");
        setShowSearchModal(true);
        setSearchInput("");
      } else {
        const result = await response.json();
        throw new Error(result.error || "Something went wrong.");
      }
    } catch (error) {
      toast.error(`Error: ${error.message} ❌`);
    } finally {
      setLoading(false);
    }
  };

  // Helper component to load spare index once
  function SpareIndexLoader({ setLoadedIndex, setSpareIndex }) {
    useState(() => {
      (async () => {
        try {
          const res = await fetch('/api/spare/list');
          const data = await res.json();
          setSpareIndex(Array.isArray(data) ? data : []);
        } catch (e) {
          setSpareIndex([]);
        } finally {
          setLoadedIndex(true);
        }
      })();
    }, []);
    return null;
  }

  const handleSearchContinue = () => {
    const name = searchInput.trim();
    if (!name) {
      setSearchError("Please enter a spare name");
      return;
    }
    const exists = spareIndex.some(
      (s) => String(s.item_name).toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setSearchError("Spare already exists. Please use a different name.");
      return;
    }
    setFormData((prev) => ({ ...prev, item_name: name }));
    setShowSearchModal(false);
  };

  return (
    <div className="bg-gray-50 flex flex-col items-center justify-center p-4 md:p-10">
      <Head>
        <title>Add New Spare Part</title>
      </Head>

      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Search or Enter Spare Name</h2>
            <p className="text-sm text-gray-600 mb-4">We will show similar spares. Proceed only if it does not exist.</p>

            {!loadedIndex && (
              <SpareIndexLoader setLoadedIndex={setLoadedIndex} setSpareIndex={setSpareIndex} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="e.g., Spark Plug"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                  autoFocus
                />
                {searchError && (
                  <div className="text-sm text-red-600 mb-2">{searchError}</div>
                )}
                <div className="flex gap-3 justify-start">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSearchContinue}
                    className="px-4 py-2 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700"
                  >
                    Continue
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-auto border rounded-lg p-2 bg-gray-50">
                <div className="text-xs text-gray-500 mb-1">Similar spares</div>
                <ul className="divide-y">
                  {spareIndex
                    .filter(
                      (s) =>
                        !searchInput ||
                        s.item_name?.toLowerCase().includes(searchInput.toLowerCase()) ||
                        s.specification?.toLowerCase().includes(searchInput.toLowerCase())
                    )
                    .slice(0, 20)
                    .map((s, idx) => (
                      <li key={idx} className="py-2 text-sm text-gray-700">
                        <span className="font-semibold">{s.item_name}</span>
                        {s.specification ? <span className="text-gray-500"> — {s.specification}</span> : null}
                      </li>
                    ))}
                  {loadedIndex && spareIndex.length === 0 && (
                    <li className="py-2 text-sm text-gray-500">No spares found.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-extrabold text-gray-800 text-center flex-grow">
            Add New Spare Part
          </h1>
          <div className="w-[80px]"></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="flex flex-col">
              <label
                htmlFor="item_name"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Item Name <span className="text-red-500">*</span>
              </label>
              <input
                id="item_name"
                name="item_name"
                type="text"
                value={formData.item_name}
                onChange={handleChange}
                placeholder="e.g., Spark Plug"
                className={`p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                  showSearchModal ? "bg-gray-100" : ""
                }`}
                required
                readOnly={showSearchModal}
              />
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="specification"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Specification
              </label>
              <input
                id="specification"
                name="specification"
                type="text"
                value={formData.specification}
                onChange={handleChange}
                placeholder="e.g., NGK, 14mm"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* New fields: Type, Make, Model */}
            <div className="flex flex-col">
              <label htmlFor="type" className="text-sm font-semibold text-gray-700 mb-2">
                Type
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Select type</option>
                <option value="Raw Materials">Raw Materials</option>
                <option value="Consumables">Consumables</option>
                <option value="Spares">Spares</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="make" className="text-sm font-semibold text-gray-700 mb-2">
                Make
              </label>
              <input
                id="make"
                name="make"
                type="text"
                value={formData.make}
                onChange={handleChange}
                placeholder="e.g., Siemens"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="model" className="text-sm font-semibold text-gray-700 mb-2">
                Model
              </label>
              <input
                id="model"
                name="model"
                type="text"
                value={formData.model}
                onChange={handleChange}
                placeholder="e.g., 6ES7 214-1AG40-0XB0"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="purchase_price"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Purchase Price <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase_price"
                name="purchase_price"
                type="number"
                step="0.01"
                value={formData.purchase_price}
                onChange={handleChange}
                placeholder="e.g., 5.99"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                required
              />
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="sale_price"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Sale Price
              </label>
              <input
                id="sale_price"
                name="sale_price"
                type="number"
                step="0.01"
                value={formData.sale_price}
                onChange={handleChange}
                placeholder="e.g., 7.99"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="last_negotiation_price"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Last Neg. Price
              </label>
              <input
                id="last_negotiation_price"
                name="last_negotiation_price"
                type="number"
                step="0.01"
                value={formData.last_negotiation_price}
                onChange={handleChange}
                placeholder="e.g., 4.99"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="tax"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Tax (%) <span className="text-red-500">*</span>
              </label>
              <input
                id="tax"
                name="tax"
                type="number"
                step="0.01"
                value={formData.tax}
                onChange={handleChange}
                placeholder="e.g., 18"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                required
              />
            </div>

            <div className="flex flex-col md:col-span-2">
              <label
                htmlFor="compatible_machine"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Compatible Machines
              </label>
              
              {/* Searchable dropdown */}
              <div className="relative">
                <input
                  type="text"
                  value={machineSearch}
                  onChange={(e) => {
                    setMachineSearch(e.target.value);
                    setShowMachineDropdown(true);
                  }}
                  onFocus={() => setShowMachineDropdown(true)}
                  placeholder="Search by product name or code (e.g., Scrubber, DSC-30)..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />

                {/* Dropdown list */}
                {showMachineDropdown && machineSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.slice(0, 20).map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addMachine(product)}
                          className="w-full text-left px-4 py-3 border-b hover:bg-blue-50 transition-colors duration-150 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">
                              {product.item_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              Product #: {product.product_number}
                            </div>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full ml-2">
                            Add
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        No products found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected machines display */}
              <div className="mt-3 flex flex-wrap gap-2">
                {formData.compatible_machine.map((machine, index) => {
                  // Find product by product_number to get item_code for display
                  const product = products.find(p => p.product_number === machine);
                  const displayCode = product ? product.item_code : machine;
                  return (
                    <span
                      key={index}
                      className="flex items-center px-3 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                    >
                      {displayCode}
                      <button
                        type="button"
                        onClick={() => removeMachine(machine)}
                        className="ml-2 text-blue-500 hover:text-blue-700 font-bold"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
              
              {formData.compatible_machine.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">No machines selected yet</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-4 p-4 border rounded-lg bg-gray-50">
            <div className="flex flex-col">
              <label
                htmlFor="image"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Image (Optional)
              </label>
              <input
                id="image"
                name="image"
                type="file"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
            <div className="flex flex-col">
              <label
                htmlFor="catalog"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Catalog (Optional, PDF)
              </label>
              <input
                id="catalog"
                name="catalog"
                type="file"
                accept=".pdf"
                onChange={(e) => setCatalogFile(e.target.files[0])}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              className={`w-full py-4 px-6 rounded-lg text-white font-bold text-lg transition-colors duration-200 ${
                loading || showSearchModal
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              disabled={loading || showSearchModal}
            >
              {loading ? "Adding Spare..." : "Add Spare"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
