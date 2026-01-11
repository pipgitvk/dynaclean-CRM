"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export default function ProductAccessoriesPage() {
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [accessories, setAccessories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Pagination & Filtering
    const [accessorySearch, setAccessorySearch] = useState("");
    const [filterMandatory, setFilterMandatory] = useState("all"); // all, mandatory, optional
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Form state for new accessory
    const [newAccessory, setNewAccessory] = useState({
        accessory_name: "",
        description: "",
        is_mandatory: false,
    });

    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({
        accessory_name: "",
        description: "",
        is_mandatory: false,
    });

    useEffect(() => {
        loadProducts();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            loadAccessories(selectedProduct.item_code);
        }
    }, [selectedProduct]);

    // Reset pagination when changing product or filters
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedProduct, accessorySearch, filterMandatory]);

    const loadProducts = async () => {
        try {
            const res = await fetch("/api/products/list");
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (err) {
            console.error("Failed to load products:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadAccessories = async (productCode) => {
        try {
            const res = await fetch(`/api/product-accessories?product_code=${productCode}`);
            if (res.ok) {
                const json = await res.json();
                setAccessories(json.data || []);
            }
        } catch (err) {
            console.error("Failed to load accessories:", err);
        }
    };

    const handleAddAccessory = async (e) => {
        e.preventDefault();
        if (!selectedProduct) {
            alert("Please select a product first");
            return;
        }
        if (!newAccessory.accessory_name.trim()) {
            alert("Accessory name is required");
            return;
        }

        try {
            setSaving(true);
            const res = await fetch("/api/product-accessories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_code: selectedProduct.item_code,
                    ...newAccessory,
                }),
            });

            const json = await res.json();
            if (json.success) {
                alert("Accessory added successfully");
                setNewAccessory({ accessory_name: "", description: "", is_mandatory: false });
                loadAccessories(selectedProduct.item_code);
            } else {
                alert(json.error || "Failed to add accessory");
            }
        } catch (err) {
            alert("Error adding accessory: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateAccessory = async (id) => {
        if (!editForm.accessory_name.trim()) {
            alert("Accessory name is required");
            return;
        }

        try {
            setSaving(true);
            const res = await fetch(`/api/product-accessories/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            });

            const json = await res.json();
            if (json.success) {
                alert("Accessory updated successfully");
                setEditingId(null);
                loadAccessories(selectedProduct.item_code);
            } else {
                alert(json.error || "Failed to update accessory");
            }
        } catch (err) {
            alert("Error updating accessory: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccessory = async (id) => {
        if (!confirm("Are you sure you want to delete this accessory?")) return;

        try {
            const res = await fetch(`/api/product-accessories/${id}`, {
                method: "DELETE",
            });

            const json = await res.json();
            if (json.success) {
                alert("Accessory deleted successfully");
                loadAccessories(selectedProduct.item_code);
            } else {
                alert(json.error || "Failed to delete accessory");
            }
        } catch (err) {
            alert("Error deleting accessory: " + err.message);
        }
    };

    const startEdit = (accessory) => {
        setEditingId(accessory.id);
        setEditForm({
            accessory_name: accessory.accessory_name,
            description: accessory.description || "",
            is_mandatory: accessory.is_mandatory === 1,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ accessory_name: "", description: "", is_mandatory: false });
    };

    const filteredProducts = products.filter((p) =>
        p.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.item_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter and paginate accessories
    const filteredAndPaginatedAccessories = useMemo(() => {
        let filtered = accessories.filter(acc => {
            const matchesSearch = acc.accessory_name.toLowerCase().includes(accessorySearch.toLowerCase()) ||
                (acc.description || "").toLowerCase().includes(accessorySearch.toLowerCase());
            const matchesMandatory = filterMandatory === "all" ||
                (filterMandatory === "mandatory" && acc.is_mandatory === 1) ||
                (filterMandatory === "optional" && acc.is_mandatory === 0);
            return matchesSearch && matchesMandatory;
        });

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginated = filtered.slice(startIndex, endIndex);

        return { items: paginated, total: filtered.length, totalPages };
    }, [accessories, accessorySearch, filterMandatory, currentPage, itemsPerPage]);

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-xl md:text-2xl font-bold mb-2">Product Accessories Management</h1>
                <p className="text-sm md:text-base text-gray-600">
                    Manage accessories that will appear as checklist items during dispatch
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Left: Product Selection */}
                <div className="bg-white rounded-lg shadow p-4 md:p-6">
                    <h2 className="text-base md:text-lg font-semibold mb-4">Select Product</h2>
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full px-3 py-2 text-sm border rounded mb-4"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="space-y-2 max-h-64 md:max-h-96 overflow-y-auto">
                        {filteredProducts.map((product) => (
                            <div
                                key={product.item_code}
                                onClick={() => setSelectedProduct(product)}
                                className={`p-3 border rounded cursor-pointer transition ${selectedProduct?.item_code === product.item_code
                                        ? "bg-blue-50 border-blue-500"
                                        : "hover:bg-gray-50"
                                    }`}
                            >
                                <div className="font-medium text-sm md:text-base">{product.item_name}</div>
                                <div className="text-xs md:text-sm text-gray-600">{product.item_code}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Accessories for Selected Product */}
                <div className="bg-white rounded-lg shadow p-4 md:p-6">
                    {selectedProduct ? (
                        <>
                            <h2 className="text-base md:text-lg font-semibold mb-2">
                                Accessories for: {selectedProduct.item_name}
                            </h2>
                            <p className="text-xs md:text-sm text-gray-600 mb-4">Code: {selectedProduct.item_code}</p>

                            {/* Add New Accessory Form */}
                            <form onSubmit={handleAddAccessory} className="mb-6 p-3 md:p-4 bg-gray-50 rounded">
                                <h3 className="text-sm md:text-base font-medium mb-3">Add New Accessory</h3>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Accessory Name *"
                                        className="w-full px-3 py-2 text-sm border rounded"
                                        value={newAccessory.accessory_name}
                                        onChange={(e) =>
                                            setNewAccessory({ ...newAccessory, accessory_name: e.target.value })
                                        }
                                        required
                                    />
                                    <textarea
                                        placeholder="Description (optional)"
                                        className="w-full px-3 py-2 text-sm border rounded"
                                        rows={2}
                                        value={newAccessory.description}
                                        onChange={(e) =>
                                            setNewAccessory({ ...newAccessory, description: e.target.value })
                                        }
                                    />
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={newAccessory.is_mandatory}
                                            onChange={(e) =>
                                                setNewAccessory({ ...newAccessory, is_mandatory: e.target.checked })
                                            }
                                        />
                                        <span className="text-sm">Mark as mandatory</span>
                                    </label>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {saving ? "Adding..." : "Add Accessory"}
                                    </button>
                                </div>
                            </form>

                            {/* Filter and Search Controls */}
                            <div className="mb-4 space-y-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        type="text"
                                        placeholder="Search accessories..."
                                        className="flex-1 px-3 py-2 text-sm border rounded"
                                        value={accessorySearch}
                                        onChange={(e) => setAccessorySearch(e.target.value)}
                                    />
                                    <select
                                        className="px-3 py-2 text-sm border rounded"
                                        value={filterMandatory}
                                        onChange={(e) => setFilterMandatory(e.target.value)}
                                    >
                                        <option value="all">All Types</option>
                                        <option value="mandatory">Mandatory Only</option>
                                        <option value="optional">Optional Only</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between text-xs md:text-sm text-gray-600">
                                    <span>
                                        Showing {filteredAndPaginatedAccessories.items.length} of {filteredAndPaginatedAccessories.total} accessories
                                    </span>
                                    <select
                                        className="px-2 py-1 text-xs border rounded"
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="10">10 per page</option>
                                        <option value="20">20 per page</option>
                                        <option value="50">50 per page</option>
                                        <option value="100">100 per page</option>
                                    </select>
                                </div>
                            </div>

                            {/* Accessories List */}
                            <div className="space-y-3">
                                {filteredAndPaginatedAccessories.total === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-8">
                                        {accessories.length === 0 ? "No accessories added yet" : "No accessories match your search"}
                                    </p>
                                ) : (
                                    <>
                                        {/* Desktop Table View */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="min-w-full text-sm border">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="p-2 border text-left">Name</th>
                                                        <th className="p-2 border text-left">Description</th>
                                                        <th className="p-2 border text-left">Type</th>
                                                        <th className="p-2 border text-center">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredAndPaginatedAccessories.items.map((acc) => (
                                                        <tr key={acc.id} className="hover:bg-gray-50">
                                                            {editingId === acc.id ? (
                                                                <>
                                                                    <td className="p-2 border">
                                                                        <input
                                                                            type="text"
                                                                            className="w-full px-2 py-1 text-sm border rounded"
                                                                            value={editForm.accessory_name}
                                                                            onChange={(e) =>
                                                                                setEditForm({ ...editForm, accessory_name: e.target.value })
                                                                            }
                                                                        />
                                                                    </td>
                                                                    <td className="p-2 border">
                                                                        <textarea
                                                                            className="w-full px-2 py-1 text-sm border rounded"
                                                                            rows={2}
                                                                            value={editForm.description}
                                                                            onChange={(e) =>
                                                                                setEditForm({ ...editForm, description: e.target.value })
                                                                            }
                                                                        />
                                                                    </td>
                                                                    <td className="p-2 border">
                                                                        <label className="flex items-center gap-2">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={editForm.is_mandatory}
                                                                                onChange={(e) =>
                                                                                    setEditForm({ ...editForm, is_mandatory: e.target.checked })
                                                                                }
                                                                            />
                                                                            <span className="text-xs">Mandatory</span>
                                                                        </label>
                                                                    </td>
                                                                    <td className="p-2 border text-center">
                                                                        <div className="flex gap-2 justify-center">
                                                                            <button
                                                                                onClick={() => handleUpdateAccessory(acc.id)}
                                                                                disabled={saving}
                                                                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                                                            >
                                                                                Save
                                                                            </button>
                                                                            <button
                                                                                onClick={cancelEdit}
                                                                                className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="p-2 border font-medium">{acc.accessory_name}</td>
                                                                    <td className="p-2 border text-gray-600 max-w-xs truncate">
                                                                        {acc.description || "-"}
                                                                    </td>
                                                                    <td className="p-2 border">
                                                                        {acc.is_mandatory === 1 ? (
                                                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                                                                Mandatory
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                                                                Optional
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2 border text-center">
                                                                        <div className="flex gap-2 justify-center">
                                                                            <button
                                                                                onClick={() => startEdit(acc)}
                                                                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteAccessory(acc.id)}
                                                                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Card View */}
                                        <div className="md:hidden space-y-3">
                                            {filteredAndPaginatedAccessories.items.map((acc) => (
                                                <div key={acc.id} className="border rounded-lg p-3 bg-white shadow-sm">
                                                    {editingId === acc.id ? (
                                                        <div className="space-y-2">
                                                            <input
                                                                type="text"
                                                                className="w-full px-2 py-1 text-sm border rounded"
                                                                value={editForm.accessory_name}
                                                                onChange={(e) =>
                                                                    setEditForm({ ...editForm, accessory_name: e.target.value })
                                                                }
                                                                placeholder="Name"
                                                            />
                                                            <textarea
                                                                className="w-full px-2 py-1 text-sm border rounded"
                                                                rows={2}
                                                                value={editForm.description}
                                                                onChange={(e) =>
                                                                    setEditForm({ ...editForm, description: e.target.value })
                                                                }
                                                                placeholder="Description"
                                                            />
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editForm.is_mandatory}
                                                                    onChange={(e) =>
                                                                        setEditForm({ ...editForm, is_mandatory: e.target.checked })
                                                                    }
                                                                />
                                                                <span>Mandatory</span>
                                                            </label>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateAccessory(acc.id)}
                                                                    disabled={saving}
                                                                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={cancelEdit}
                                                                    className="flex-1 px-3 py-2 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="font-medium text-sm">{acc.accessory_name}</div>
                                                                {acc.is_mandatory === 1 ? (
                                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                                                                        Mandatory
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                                                                        Optional
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {acc.description && (
                                                                <p className="text-xs text-gray-600 mb-2">{acc.description}</p>
                                                            )}
                                                            <div className="flex gap-2 pt-2 border-t">
                                                                <button
                                                                    onClick={() => startEdit(acc)}
                                                                    className="flex-1 px-3 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 text-sm"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteAccessory(acc.id)}
                                                                    className="flex-1 px-3 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50 text-sm"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Pagination Controls */}
                                        {filteredAndPaginatedAccessories.totalPages > 1 && (
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                                                <div className="text-xs md:text-sm text-gray-600">
                                                    Page {currentPage} of {filteredAndPaginatedAccessories.totalPages}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setCurrentPage(1)}
                                                        disabled={currentPage === 1}
                                                        className="px-2 md:px-3 py-1 text-xs md:text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
                                                    >
                                                        First
                                                    </button>
                                                    <button
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                        className="px-2 md:px-3 py-1 text-xs md:text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
                                                    >
                                                        Prev
                                                    </button>
                                                    <button
                                                        onClick={() => setCurrentPage(p => Math.min(filteredAndPaginatedAccessories.totalPages, p + 1))}
                                                        disabled={currentPage === filteredAndPaginatedAccessories.totalPages}
                                                        className="px-2 md:px-3 py-1 text-xs md:text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
                                                    >
                                                        Next
                                                    </button>
                                                    <button
                                                        onClick={() => setCurrentPage(filteredAndPaginatedAccessories.totalPages)}
                                                        disabled={currentPage === filteredAndPaginatedAccessories.totalPages}
                                                        className="px-2 md:px-3 py-1 text-xs md:text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
                                                    >
                                                        Last
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-500 py-12">
                            <p className="text-sm md:text-base">Select a product from the left to manage its accessories</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6">
                <button
                    onClick={() => router.back()}
                    className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                >
                    Back
                </button>
            </div>
        </div>
    );
}
