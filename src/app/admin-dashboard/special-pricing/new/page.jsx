"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateSpecialPrice() {
  const router = useRouter();
 const [form, setForm] = useState({
    customer_id: "",
    product_id: "",
    product_code:"",
    price: "",
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // 🔥 Fetch products once
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products/list");
        const data = await res.json();
       
        
        setProducts(data);
      } catch (err) {
        console.error("Product fetch failed", err);
      }
    };

    fetchProducts();
  }, []);

  // 🔍 Customer Search (Debounced)
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!customerSearch) {
        setCustomers([]);
        return;
      }

      try {
        setLoadingCustomers(true);

        const res = await fetch(
          `/api/customers/list?search=${encodeURIComponent(customerSearch)}`
        );

        if (!res.ok) {
          const text = await res.text();
          console.error("API Error:", text);
          return;
        }

        const data = await res.json();
        setCustomers(data);

      } catch (err) {
        console.error("Customer search failed", err);
      } finally {
        setLoadingCustomers(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [customerSearch]);

  // 🔥 Product change handler
  const handleProductChange = (e) => {
    const selectedId = e.target.value;
  
    

    const selectedProduct = products.find(
      (p) => p.id.toString() === selectedId
    );

    setForm({
      ...form,
      product_id: selectedId,
      product_code: selectedProduct?.item_code || "",
      price: selectedProduct?.price_per_unit || "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    await fetch("/api/special-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    router.push("/user-dashboard/special-pricing");
  };

 
  

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold mb-6">Create Special Price</h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 🔍 Customer Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search Customer (name, phone, email)"
            className="border p-2 w-full"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
          />

          {loadingCustomers && (
            <div className="text-sm text-gray-500 mt-1">
              Searching...
            </div>
          )}

          {customers.length > 0 && (
            <div className="border mt-1 max-h-40 overflow-y-auto bg-white absolute w-full z-10">
              {customers.map((customer) => (
                <div
                  key={customer.customer_id}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setForm({
                      ...form,
                      customer_id: customer.customer_id,
                    });

                    setCustomerSearch(
                      `${customer.first_name} ${customer.last_name || ""}`
                    );

                    setCustomers([]);
                  }}
                >
                  <div className="font-medium">
                    {customer.first_name} {customer.last_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {customer.phone} | {customer.company}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Dropdown */}
        <select
          className="border p-2 w-full"
          value={form.product_id}
          onChange={handleProductChange}
          required
        >
          <option value="">Select Product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.item_name}
            </option>
          ))}
        </select>

        {/* Special Price */}
        <input
          type="number"
          placeholder="Special Price"
          className="border p-2 w-full"
          value={form.price}
          onChange={(e) =>
            setForm({ ...form, price: e.target.value })
          }
          required
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">
          Save
        </button>
      </form>
    </div>
  );
}
