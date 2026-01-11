"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Head from "next/head";

export default function AddProductPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    item_name: "",
    item_code: "",
    category: "",
    specification: "",
    gst_rate: "",
    hsn_sac: "",
    unit: "",
    price_per_unit: "",
  });
  const [images, setImages] = useState({
    product_image: null,
    img_1: null,
    img_2: null,
    img_3: null,
    img_4: null,
    img_5: null,
  });
  const [showOptionalImages, setShowOptionalImages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Popup state for product code pre-check
  const [showCodeModal, setShowCodeModal] = useState(true);
  const [codeInput, setCodeInput] = useState("");
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [productIndex, setProductIndex] = useState([]);
  const [loadedIndex, setLoadedIndex] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      setImages((prev) => ({ ...prev, [name]: files[0] }));
    }
  };

  const handleCodeCheck = async () => {
    const code = codeInput.trim();
    if (!code) {
      setCodeError("Please enter a product code");
      return;
    }
    setCodeError("");
    setCodeChecking(true);
    try {
      // One-time search: use pre-fetched index to decide
      const exists = productIndex.some(
        (p) => String(p.item_code).toLowerCase() === code.toLowerCase()
      );
      if (exists) {
        setCodeError("Product code already exists. Please use a different code.");
      } else {
        setFormData((prev) => ({ ...prev, item_code: code }));
        setShowCodeModal(false);
      }
    } catch (err) {
      setCodeError(err.message || "Something went wrong");
    } finally {
      setCodeChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const data = new FormData();
    Object.keys(formData).forEach((key) => data.append(key, formData[key]));
    Object.keys(images).forEach((key) => {
      if (images[key]) {
        data.append(key, images[key]);
      }
    });

    try {
      const response = await fetch("/api/add-product", {
        method: "POST",
        body: data,
      });

      const contentType = response.headers.get("content-type") || "";
      let payload;
      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        const text = await response.text();
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text };
        }
      }

      if (!response.ok) {
        const details = Array.isArray(payload?.errors)
          ? payload.errors
              .map((e) => (e?.msg || e?.message || e))
              .filter(Boolean)
              .join("; ")
          : payload?.errors && typeof payload.errors === "object"
          ? Object.values(payload.errors)
              .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
              .join("; ")
          : null;

        let serverMessage =
          payload?.detail ||
          payload?.error ||
          payload?.message ||
          payload?.msg ||
          payload?.raw ||
          response.statusText ||
          "Request failed";

        if (details) serverMessage = `${serverMessage} - ${details}`;

        throw new Error(`[${response.status}] ${serverMessage}`);
      }

      setMessage(payload?.message || "Product added successfully! ✅");
      setFormData({
        item_name: "",
        item_code: "",
        category: "",
        specification: "",
        gst_rate: "",
        hsn_sac: "",
        unit: "",
        price_per_unit: "",
      });
      setImages({
        product_image: null,
        img_1: null,
        img_2: null,
        img_3: null,
        img_4: null,
        img_5: null,
      });
      setShowOptionalImages(false);
      setShowCodeModal(true);
      setCodeInput("");
    } catch (error) {
      setMessage(`Error: ${error.message} ❌`);
    } finally {
      setLoading(false);
    }
  };

  const inputFields = [
    {
      label: "Item Name",
      name: "item_name",
      required: true,
      placeholder: "e.g., Apple iPhone 15",
    },
    {
      label: "Item Code",
      name: "item_code",
      required: true,
      placeholder: "e.g., IPH15-PRO-256GB",
    },
    {
      label: "Category",
      name: "category",
      required: true,
      placeholder: "e.g., 7 ",
    },
    {
      label: "Specification",
      name: "specification",
      placeholder: "e.g., 6.1-inch display, 256GB",
    },
    {
      label: "GST Rate (%)",
      name: "gst_rate",
      type: "number",
      required: true,
      placeholder: "e.g., 18",
    },
    {
      label: "HSN/SAC",
      name: "hsn_sac",
      required: true,
      placeholder: "e.g., 85171200",
    },
    { label: "Unit", name: "unit", required: true, placeholder: "e.g., pcs" },
    {
      label: "Price Per Unit",
      name: "price_per_unit",
      type: "number",
      required: true,
      placeholder: "e.g., 999.99",
    },
  ];

  const optionalImageFields = [
    { label: "Image 1 (Optional)", name: "img_1" },
    { label: "Image 2 (Optional)", name: "img_2" },
    { label: "Image 3 (Optional)", name: "img_3" },
    { label: "Image 4 (Optional)", name: "img_4" },
    { label: "Image 5 (Optional)", name: "img_5" },
  ];

  const isCodeLocked = !showCodeModal && !!formData.item_code;

  // Helper component to load product index once
  function IndexLoader({ setLoadedIndex, setProductIndex }) {
    useState(() => {
      (async () => {
        try {
          const res = await fetch('/api/products/list');
          const data = await res.json();
          setProductIndex(Array.isArray(data) ? data : []);
        } catch (e) {
          setProductIndex([]);
        } finally {
          setLoadedIndex(true);
        }
      })();
    }, []);
    return null;
  }

  return (
    <div className=" bg-gray-50 flex flex-col items-center justify-center p-4 md:p-10">
      <Head>
        <title>Add New Product</title>
      </Head>

      {/* Product Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Enter Product Code</h2>
            <p className="text-sm text-gray-600 mb-4">We will check availability and show similar products.</p>

            {/* One-time load of index */}
            {!loadedIndex && (
              <IndexLoader setLoadedIndex={setLoadedIndex} setProductIndex={setProductIndex} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="e.g., IPH15-PRO-256GB"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                  autoFocus
                />
                {codeError && (
                  <div className="text-sm text-red-600 mb-2">{codeError}</div>
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
                    onClick={handleCodeCheck}
                    disabled={codeChecking}
                    className={`px-4 py-2 rounded-lg text-white font-semibold ${codeChecking ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                  >
                    {codeChecking ? "Checking..." : "Continue"}
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-auto border rounded-lg p-2 bg-gray-50">
                <div className="text-xs text-gray-500 mb-1">Similar products</div>
                <ul className="divide-y">
                  {productIndex
                    .filter(
                      (p) =>
                        !codeInput ||
                        p.item_code?.toLowerCase().includes(codeInput.toLowerCase()) ||
                        p.item_name?.toLowerCase().includes(codeInput.toLowerCase())
                    )
                    .slice(0, 20)
                    .map((p, idx) => (
                      <li key={idx} className="py-2 text-sm text-gray-700">
                        <span className="font-semibold">{p.item_code}</span> — {p.item_name}
                      </li>
                    ))}
                  {loadedIndex && productIndex.length === 0 && (
                    <li className="py-2 text-sm text-gray-500">No products found.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-7xl">
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
            Add New Product
          </h1>
          <div className="w-[80px]"></div>
        </div>
        {message && (
          <div
            className={`p-4 mb-6 text-center rounded-lg font-medium ${
              message.includes("successfully")
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {inputFields.map((field) => (
              <div key={field.name} className="flex flex-col">
                <label
                  htmlFor={field.name}
                  className="text-sm font-semibold text-gray-700 mb-2"
                >
                  {field.label}{" "}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type || "text"}
                  value={formData[field.name]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className={`p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    field.name === "item_code" && isCodeLocked ? "bg-gray-100" : ""
                  }`}
                  required={field.required}
                  readOnly={field.name === "item_code" && isCodeLocked}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div className="flex flex-col">
              <label
                htmlFor="product_image"
                className="text-sm font-semibold text-gray-700 mb-2"
              >
                Product Main Image <span className="text-red-500">*</span>
              </label>
              <input
                id="product_image"
                name="product_image"
                type="file"
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                required
              />
            </div>

            {!showOptionalImages && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setShowOptionalImages(true)}
                  className="w-full py-3 px-4 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-semibold"
                >
                  Add More Images
                </button>
              </div>
            )}
          </div>

          {showOptionalImages && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 mt-4 p-4 border rounded-lg bg-gray-50">
              {optionalImageFields.map((field) => (
                <div key={field.name} className="flex flex-col">
                  <label
                    htmlFor={field.name}
                    className="text-sm font-semibold text-gray-700 mb-2"
                  >
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="file"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-8">
            <button
              type="submit"
              className={`w-full py-4 px-6 rounded-lg text-white font-bold text-lg transition-colors duration-200 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              disabled={loading || showCodeModal}
            >
              {loading ? "Adding Product..." : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
