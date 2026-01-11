// app/user-dashboard/blogs/[slug]/page.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";

// Dynamically import the TinyMCE editor
const Editor = dynamic(
  () => import("@tinymce/tinymce-react").then((mod) => mod.Editor),
  {
    ssr: false,
  }
);

const BlogEditorPage = () => {
  const { slug } = useParams();
  const router = useRouter();
  const [blogData, setBlogData] = useState({
    title: "",
    slug: "",
    content: "",
    image_path: "",
    meta_tags: "",
    og_tags: "",
    category: "",
    status: "draft",
  });
  const [loading, setLoading] = useState(true);
  const [isNewBlog, setIsNewBlog] = useState(slug === "new");
  const [imageFile, setImageFile] = useState(null);

  // Helper to generate a URL-friendly slug from the title
  const generateSlug = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, "-")
      // Remove all non-word chars except hyphens
      .replace(/[^a-z0-9-]/g, "")
      // Replace multiple hyphens with a single one
      .replace(/-+/g, "-");
  };

  useEffect(() => {
    if (!isNewBlog) {
      const fetchBlog = async () => {
        try {
          const response = await fetch(`/api/blogs/${slug}`);
          if (!response.ok) {
            throw new Error("Failed to fetch blog data.");
          }
          const data = await response.json();
          setBlogData(data.blog);
        } catch (err) {
          toast.error(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchBlog();
    } else {
      setLoading(false);
    }
  }, [slug, isNewBlog]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // When creating a new blog, auto-generate the slug from the title
    if (name === "title" && isNewBlog) {
      const autoSlug = generateSlug(value);
      setBlogData((prev) => ({
        ...prev,
        title: value,
        // Only overwrite slug if user has not manually typed something different
        slug: prev.slug && prev.slug !== generateSlug(prev.title) ? prev.slug : autoSlug,
      }));
      return;
    }

    setBlogData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  const handleEditorChange = (content, editor) => {
    setBlogData((prev) => ({ ...prev, content }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("title", blogData.title);
    formData.append("slug", blogData.slug);
    formData.append("content", blogData.content);
    formData.append("meta_tags", blogData.meta_tags);
    formData.append("og_tags", blogData.og_tags);
    formData.append("category", blogData.category);
    formData.append("status", blogData.status);
    formData.append("created_by", 1); // Replace with actual user ID

    if (imageFile) {
      formData.append("image", imageFile);
    } else if (blogData.image_path) {
      formData.append("image_path", blogData.image_path);
    }

    const method = isNewBlog ? "POST" : "PUT";
    const url = isNewBlog ? "/api/blogs" : `/api/blogs/${slug}`;

    try {
      const response = await fetch(url, {
        method,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save blog.");
      }

      toast.success(`Blog ${isNewBlog ? "created" : "updated"} successfully!`);
      router.push("/user-dashboard/blogs");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <h1 className="text-3xl  text-gray-900 mb-6 text-center">
        {isNewBlog ? "Create New Blog" : "Edit Blog"}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-white rounded-lg shadow">
            <label className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={blogData.title}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
              required
            />
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <label className="block text-sm font-medium text-gray-700">
              Slug (URL Path)
            </label>
            <input
              type="text"
              name="slug"
              value={blogData.slug}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
              disabled={!isNewBlog}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-white rounded-lg shadow">
            <label className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <input
              type="text"
              name="category"
              value={blogData.category}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
            />
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <label className="block text-sm font-medium text-gray-700">
              Featured Image
            </label>
            <input
              type="file"
              name="image"
              onChange={handleImageChange}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {blogData.image_path && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Current Image:</p>
                <img
                  src={blogData.image_path}
                  alt="Current featured image"
                  className="mt-2 h-32 w-auto rounded-md object-cover"
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700">
            Content
          </label>
          <Editor
            apiKey="0haw6pxrcbpgxr764l57vvz0rxi8su156w31f3yg36loxa9f"
            value={blogData.content}
            init={{
              height: 500,
              menubar: true,
              plugins: [
                "advlist autolink lists link image charmap preview anchor",
                "searchreplace visualblocks code fullscreen",
                "insertdatetime media table paste code help wordcount",
              ],
              toolbar:
                "undo redo | formatselect | " +
                "bold italic underline forecolor backcolor | " +
                "alignleft aligncenter alignright alignjustify | " +
                "bullist numlist outdent indent | " +
                "link unlink | image media | removeformat | help",
              link_context_toolbar: true,
              default_link_target: "_blank",
            }}
            onEditorChange={handleEditorChange}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-white rounded-lg shadow">
            <label className="block text-sm font-medium text-gray-700">
              Meta Tags (comma-separated)
            </label>
            <textarea
              name="meta_tags"
              value={blogData.meta_tags}
              onChange={handleInputChange}
              rows="4"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
            />
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <label className="block text-sm font-medium text-gray-700">
              Open Graph Tags
            </label>
            <textarea
              name="og_tags"
              value={blogData.og_tags}
              onChange={handleInputChange}
              rows="4"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
            />
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            name="status"
            value={blogData.status}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Saving..." : isNewBlog ? "Create Blog" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BlogEditorPage;
