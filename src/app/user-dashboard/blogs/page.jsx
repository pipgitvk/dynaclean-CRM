// app/user-dashboard/blogs/page.jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import toast from "react-hot-toast";

const BlogManagementPage = () => {
  const [blogs, setBlogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const response = await fetch("/api/blogs");
        if (!response.ok) {
          throw new Error("Failed to fetch blogs.");
        }
        const data = await response.json();
        setBlogs(data.blogs);
      } catch (err) {
        setError(err.message);
        toast.error("Failed to load blogs.");
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  const filteredBlogs = blogs.filter((blog) =>
    blog.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading blogs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Blog Posts</h1>
        <Link
          href="/user-dashboard/blogs/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add New Blog
        </Link>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search blogs by title..."
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredBlogs.length === 0 ? (
        <div className="text-center text-gray-500 py-10">No blogs found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlogs.map((blog) => (
            <Link key={blog.id} href={`/user-dashboard/blogs/${blog.slug}`}>
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden cursor-pointer">
                {blog.image_path && (
                  <div className="relative w-full h-48">
                    <img
                      src={blog.image_path}
                      alt={blog.title}
                      className="w-full h-48 object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h2 className="text-xl font-bold text-gray-900 mb-2 truncate">
                    {blog.title}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Category:{" "}
                    <span className="font-semibold">{blog.category}</span>
                  </p>
                  <p className="text-sm text-gray-500 mb-2">
                    Status:{" "}
                    <span
                      className={`font-semibold ${blog.status === "published"
                        ? "text-green-600"
                        : "text-yellow-600"
                        }`}
                    >
                      {blog.status}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Last updated:{" "}
                    {format(new Date(blog.updated_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlogManagementPage;
